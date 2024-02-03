import fs from 'fs';
import { MemoFile } from './src/memo-file';
import { DbfReader } from './src/dbf-reader';

const dbf = fs.readFileSync('my.DBF');
const memo = new MemoFile('my.FPT');
const r = DbfReader.read(dbf, memo)
console.log(r)
memo.close();