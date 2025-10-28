#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum XmlTok<'a> {
    OpenTag { raw: &'a str, name: &'a str },  // "<tag ...>"
    CloseTag { raw: &'a str, name: &'a str }, // "</tag>"
    SelfCloseTag(&'a str),                    // "<tag .../>"
    Comment(&'a str),                         // "<!-- ... -->"
    CData(&'a str),                           // "<![CDATA[ ... ]]>"
    ProcInst(&'a str),                        // "<?xml ...?>"
    Doctype(&'a str),                         // "<!DOCTYPE ...>"
    Text(&'a str),                            // "text between tags"
    Template(&'a str),                        // "${[ ... ]}"
}

fn writeln_indented(out: &mut String, depth: usize, indent: &str, s: &str) {
    for _ in 0..depth {
        out.push_str(indent);
    }
    out.push_str(s);
    out.push('\n');
}

pub fn format_xml(input: &str, indent: &str) -> String {
    use XmlTok::*;
    let tokens = tokenize_with_templates(input);

    let mut out = String::new();
    let mut depth = 0usize;
    let mut i = 0usize;

    while i < tokens.len() {
        match tokens[i] {
            OpenTag {
                raw: open_raw,
                name: open_name,
            } => {
                if i + 2 < tokens.len() {
                    if let Text(text_raw) = tokens[i + 1] {
                        let trimmed = text_raw.trim();
                        let no_newlines = !trimmed.contains('\n');
                        if no_newlines && !trimmed.is_empty() {
                            if let CloseTag {
                                raw: close_raw,
                                name: close_name,
                            } = tokens[i + 2]
                            {
                                if open_name == close_name {
                                    for _ in 0..depth {
                                        out.push_str(indent);
                                    }
                                    out.push_str(open_raw);
                                    out.push_str(trimmed);
                                    out.push_str(close_raw);
                                    out.push('\n');
                                    i += 3;
                                    continue;
                                }
                            }
                        }
                    }
                }
                writeln_indented(&mut out, depth, indent, open_raw);
                depth = depth.saturating_add(1);
                i += 1;
            }

            CloseTag { raw, .. } => {
                depth = depth.saturating_sub(1);
                writeln_indented(&mut out, depth, indent, raw);
                i += 1;
            }

            SelfCloseTag(raw) | Comment(raw) | ProcInst(raw) | Doctype(raw) | CData(raw)
            | Template(raw) => {
                writeln_indented(&mut out, depth, indent, raw);
                i += 1;
            }

            Text(text_raw) => {
                if text_raw.chars().any(|c| !c.is_whitespace()) {
                    let trimmed = text_raw.trim();
                    writeln_indented(&mut out, depth, indent, trimmed);
                }
                i += 1;
            }
        }
    }

    if out.ends_with('\n') {
        out.pop();
    }
    out
}

fn tokenize_with_templates(input: &str) -> Vec<XmlTok<'_>> {
    use XmlTok::*;
    let bytes = input.as_bytes();
    let mut i = 0usize;
    let mut toks = Vec::<XmlTok>::new();

    let starts_with =
        |s: &[u8], i: usize, pat: &str| s.get(i..).map_or(false, |t| t.starts_with(pat.as_bytes()));

    while i < bytes.len() {
        // Template block: ${[ ... ]}
        if starts_with(bytes, i, "${[") {
            let start = i;
            i += 3;
            while i < bytes.len() && !starts_with(bytes, i, "]}") {
                i += 1;
            }
            if starts_with(bytes, i, "]}") {
                i += 2;
            }
            toks.push(Template(&input[start..i]));
            continue;
        }

        if bytes[i] == b'<' {
            // Comments
            if starts_with(bytes, i, "<!--") {
                let start = i;
                i += 4;
                while i < bytes.len() && !starts_with(bytes, i, "-->") {
                    i += 1;
                }
                if starts_with(bytes, i, "-->") {
                    i += 3;
                }
                toks.push(Comment(&input[start..i]));
                continue;
            }
            // CDATA
            if starts_with(bytes, i, "<![CDATA[") {
                let start = i;
                i += 9;
                while i < bytes.len() && !starts_with(bytes, i, "]]>") {
                    i += 1;
                }
                if starts_with(bytes, i, "]]>") {
                    i += 3;
                }
                toks.push(CData(&input[start..i]));
                continue;
            }
            // Processing Instruction
            if starts_with(bytes, i, "<?") {
                let start = i;
                i += 2;
                while i < bytes.len() && !starts_with(bytes, i, "?>") {
                    i += 1;
                }
                if starts_with(bytes, i, "?>") {
                    i += 2;
                }
                toks.push(ProcInst(&input[start..i]));
                continue;
            }
            // DOCTYPE or other "<!"
            if starts_with(bytes, i, "<!") {
                let start = i;
                i += 2;
                while i < bytes.len() && bytes[i] != b'>' {
                    i += 1;
                }
                if i < bytes.len() {
                    i += 1;
                }
                toks.push(Doctype(&input[start..i]));
                continue;
            }

            // Normal tag (open/close/self)
            let start = i;
            i += 1; // '<'

            let is_close = if i < bytes.len() && bytes[i] == b'/' {
                i += 1;
                true
            } else {
                false
            };

            // read until '>' (respecting quotes)
            let mut in_quote: Option<u8> = None;
            while i < bytes.len() {
                let c = bytes[i];
                if let Some(q) = in_quote {
                    if c == q {
                        in_quote = None;
                    }
                    i += 1;
                } else {
                    if c == b'\'' || c == b'"' {
                        in_quote = Some(c);
                        i += 1;
                    } else if c == b'>' {
                        i += 1;
                        break;
                    } else {
                        i += 1;
                    }
                }
            }

            let raw = &input[start..i];
            let is_self = raw.as_bytes().len() >= 2 && raw.as_bytes()[raw.len() - 2] == b'/';
            if is_close {
                let name = parse_close_name(raw);
                toks.push(CloseTag { raw, name });
            } else if is_self {
                toks.push(SelfCloseTag(raw));
            } else {
                let name = parse_open_name(raw);
                toks.push(OpenTag { raw, name });
            }
            continue;
        }

        // Text node until next '<' or template start
        let start = i;
        while i < bytes.len() && bytes[i] != b'<' && !starts_with(bytes, i, "${[") {
            i += 1;
        }
        toks.push(XmlTok::Text(&input[start..i]));
    }

    toks
}

fn parse_open_name(raw: &str) -> &str {
    // raw looks like "<name ...>" or "<name>"
    // slice between '<' and first whitespace or '>' or '/>'
    let s = &raw[1..]; // skip '<'
    let end = s.find(|c: char| c.is_whitespace() || c == '>' || c == '/').unwrap_or(s.len());
    &s[..end]
}

fn parse_close_name(raw: &str) -> &str {
    // raw looks like "</name>"
    let s = &raw[2..]; // skip "</"
    let end = s.find('>').unwrap_or(s.len());
    &s[..end]
}

#[cfg(test)]
mod tests {
    use super::format_xml;

    #[test]
    fn inline_text_child() {
        let src = r#"<root><foo>this might be a string</foo><bar attr="x">ok</bar></root>"#;
        let want = r#"<root>
  <foo>this might be a string</foo>
  <bar attr="x">ok</bar>
</root>"#;
        assert_eq!(format_xml(src, "  "), want);
    }

    #[test]
    fn works_when_nested() {
        let src = r#"<root><foo><b>bold</b></foo></root>"#;
        let want = r#"<root>
  <foo>
    <b>bold</b>
  </foo>
</root>"#;
        assert_eq!(format_xml(src, "  "), want);
    }

    #[test]
    fn trims_and_keeps_nonempty() {
        let src = "<root><foo>  hi  </foo></root>";
        let want = "<root>\n  <foo>hi</foo>\n</root>";
        assert_eq!(format_xml(src, "  "), want);
    }
    #[test]
    fn attributes_inline_text_child() {
        // Keeps attributes verbatim and inlines simple text children
        let src = r#"<root><item id="42" class='a b'>value</item></root>"#;
        let want = r#"<root>
  <item id="42" class='a b'>value</item>
</root>"#;
        assert_eq!(format_xml(src, "  "), want);
    }

    #[test]
    fn attributes_with_irregular_spacing_preserved() {
        // We don't normalize spaces inside the tag; raw is preserved
        let src = r#"<root><a   x = "1"   y='2'    >t</a></root>"#;
        let want = r#"<root>
  <a   x = "1"   y='2'    >t</a>
</root>"#;
        assert_eq!(format_xml(src, "  "), want);
    }

    #[test]
    fn self_closing_with_attributes() {
        let src =
            r#"<root><img src="x" alt='hello &quot;world&quot;' width="10" height="20"/></root>"#;
        let want = r#"<root>
  <img src="x" alt='hello &quot;world&quot;' width="10" height="20"/>
</root>"#;
        assert_eq!(format_xml(src, "  "), want);
    }

    #[test]
    fn template_in_attribute_self_closing() {
        let src = r#"<root><x attr=${[ compute(1, "two") ]}/></root>"#;
        let want = r#"<root>
  <x attr=${[ compute(1, "two") ]}/>
</root>"#;
        assert_eq!(format_xml(src, "  "), want);
    }

    #[test]
    fn attributes_and_nested_children_expand() {
        // Not inlined because child is an element, not plain text
        let src = r#"<root><box kind="card"><b>bold</b></box></root>"#;
        let want = r#"<root>
  <box kind="card">
    <b>bold</b>
  </box>
</root>"#;
        assert_eq!(format_xml(src, "  "), want);
    }

    #[test]
    fn namespace_and_xml_attrs() {
        let src = r#"<root><ns:el xml:lang="en">ok</ns:el></root>"#;
        let want = r#"<root>
  <ns:el xml:lang="en">ok</ns:el>
</root>"#;
        assert_eq!(format_xml(src, "  "), want);
    }

    #[test]
    fn mixed_quote_styles_in_attributes() {
        // Single-quoted attr containing double quotes is fine; we don't re-quote
        let src = r#"<root><a title='He said "hi"'>hello</a></root>"#;
        let want = r#"<root>
  <a title='He said "hi"'>hello</a>
</root>"#;
        assert_eq!(format_xml(src, "  "), want);
    }
}
