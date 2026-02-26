import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const pdfPath = path.resolve(__dirname, '..', 'data', 'courses', 'typescript-profesional.pdf');
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdf = new PDFParse({ data: new Uint8Array(dataBuffer) });
  const result = await pdf.getText();
  console.log(result.text);
}

main();
