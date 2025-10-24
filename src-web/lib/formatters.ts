import XmlBeautify from 'xml-beautify';
import { invokeCmd } from './tauri';

const INDENT = '  ';

const xmlBeautifier = new XmlBeautify({
  INDENT,
});

export async function tryFormatJson(text: string): Promise<string> {
  if (text === '') return text;

  try {
    const result = await invokeCmd<string>('cmd_format_json', { text });
    return result;
  } catch (err) {
    console.warn('Failed to format JSON', err);
    // Nothing
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (err) {
    console.log("JSON beautify failed", err);
  }

  return text;
}

export async function tryFormatXml(text: string): Promise<string> {
  if (text === '') return text;

  try {
    return xmlBeautifier.beautify(text);
  } catch (err) {
    console.log("XML beautify failed", err);
    return text;
  }
}
