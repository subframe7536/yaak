import xmlFormat from 'xml-formatter';
import { jsonrepair } from "jsonrepair";
import { invokeCmd } from './tauri';

export async function tryFormatJson(text: string): Promise<string> {
  if (text === '') return text;

  try {
    const jsonObject = jsonrepair(
      text.replace(/(^|\n)\s*[\u3000\u2000-\u200F\u2028-\u202F]+/g, '$1    ')
    );
    return JSON.stringify(JSON.parse(jsonObject), null, 2);
  } catch (error) {
    console.error('Failed to format JSON:', error);
    return text;
  }
}

export async function tryFormatXml(text: string): Promise<string> {
  if (text === '') return text;

  try {
    const result = await invokeCmd<string>('cmd_format_xml', { text });
    return result;
  } catch (err) {
    console.warn('Failed to format XML', err);
  }

  return text;
}


