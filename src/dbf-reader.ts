/**
 * Lifted from 
 * https://github.com/shubhgupta4u/dbf-reader
 * Modified to accept a memo file in the read function
 */

import { MemoFile } from "./memo-file";

export class DataTable {
	columns: Array<Column>;
	rows: Array<any>;
	constructor() {
		this.columns = new Array<Column>();
		this.rows = new Array<any>();
	}
}
export class Column {
	name: string;
	type: string;
}

export  class DbfReader {
	static readonly fileHeaderSize: number = 31;
	static readonly fieldDescriptorSize: number = 32;
	private static readFieldsInfo(dbaseFile: Buffer): Array<any> {
		try {
			let byteRead: number;
			const fields: Array<any> = new Array<any>();
			let i = 0;
			do {
				byteRead =
					DbfReader.fileHeaderSize + i * DbfReader.fieldDescriptorSize + 1;
				let fieldNameLength = 0;
				while (
					Buffer.from(
						dbaseFile.subarray(
							byteRead + fieldNameLength,
							byteRead + fieldNameLength + 1,
						),
					).toString("utf8") !== "\u0000" &&
					fieldNameLength < 11
				) {
					fieldNameLength += 1;
				}
				const fieldName: string = Buffer.from(
					dbaseFile.subarray(byteRead, byteRead + fieldNameLength),
				).toString("utf8");
				byteRead = byteRead + 11;
				const fieldType: string = Buffer.from(
					dbaseFile.subarray(byteRead, byteRead + 1),
				).toString("utf8");
				byteRead = byteRead + 1;
				byteRead = byteRead + 4; //reserved
				const fieldLength: number = dbaseFile.readIntLE(byteRead, 1);
				byteRead = byteRead + 1;
				const decimalCount: number = dbaseFile.readIntLE(byteRead, 1);
				byteRead = byteRead + 1;
				fields.push(
					new DbfReader.FieldDescriptor(
						fieldName,
						fieldType,
						fieldLength,
						decimalCount,
					),
				);
				byteRead = byteRead + 14; // Not required to read
				i += 1;
			} while (
				Buffer.from(dbaseFile.subarray(byteRead, byteRead + 1)).toString(
					"utf8",
				) !== "\r"
			);
			return fields;
		} catch (error) {
			throw error;
		}
	}
	private static getDateValue(value: string) {
		try {
			if (value.length === 8) {
				const year = value.substr(0, 4);
				const month = value.substr(4, 2);
				const date = value.substr(6, 2);
				return new Date(+year, +month, +date);
			}
		} catch (error) {
			console.log(error);
		}
		return null;
	}
	private static getFieldValue(
		valueBuffer: Buffer,
		type: string,
		decimalCount: number,
		fieldlength: number,
	): any {
		let value: any = valueBuffer.toString("utf8").trim();
		const byteRead = 0;
		let valueLength = 0;
		try {
			switch (type.trim().toLowerCase()) {
				case "q":
					value = value;
					break;
				case "v":
					while (
						Buffer.from(
							valueBuffer.subarray(
								byteRead + valueLength,
								byteRead + valueLength + 1,
							),
						).toString("utf8") !== "\u0000" &&
						valueLength < fieldlength
					) {
						valueLength += 1;
					}
					value = Buffer.from(
						valueBuffer.subarray(byteRead, byteRead + valueLength),
					)
						.toString("utf8")
						.trim();
					break;
				case "c":
					value = value;
					break;
				case "d":
					value = DbfReader.getDateValue(value);
					break;
				case "f":
				case "n":
					value = +value;
					break;
				case "l":
					if (value.toLowerCase() === "y" || value.toLowerCase() === "t") {
						value = true;
					} else {
						value = false;
					}
					break;
				case "g":
				case "i":
					value = valueBuffer.readIntLE(0, valueBuffer.byteLength);
					break;
				case "y": {
					let currency: string = valueBuffer
						.readIntLE(0, valueBuffer.byteLength)
						.toString();
					currency = `${currency.substr(
						0,
						currency.length - decimalCount,
					)}.${currency.substr(
						currency.length - decimalCount,
						currency.length - 4,
					)}`;
					value = +currency;
					break;
				}
				case "b":
					value = valueBuffer.readDoubleLE(0);
					break;
				case "t": {
					const dateWord: number = valueBuffer.readInt32LE(0);
					const duration: number = valueBuffer.readInt32LE(4);
					const seconds = Math.floor((duration / 1000) % 60);
					const minutes = Math.floor((duration / (1000 * 60)) % 60);
					const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

					const date = DbfReader.julianIntToDate(dateWord);
					value = new Date(
						date.getFullYear(),
						date.getMonth(),
						date.getDate(),
						hours,
						minutes,
						seconds,
					);
					break;
				}
				case "m":
					value = valueBuffer.readIntLE(0, valueBuffer.byteLength);
					break;
				default:
					console.log(`Unsupported field type ${type}`);
			}
		} catch (error) {
			console.log(error);
		}
		return value;
	}
	private static julianIntToDate(jd: number): Date {
		let year;
		let month;
		let day;
		let l;
		let n;
		let i;
		let j;
		let k;

		l = jd + 68569;
		n = Math.floor(Math.floor(4 * l) / 146097);
		l = l - Math.floor((146097 * n + 3) / 4);
		i = Math.floor((4000 * (l + 1)) / 1461001);
		l = l - Math.floor((1461 * i) / 4) + 31;
		j = Math.floor((80 * l) / 2447);
		k = l - Math.floor((2447 * j) / 80);
		l = Math.floor(j / 11);
		j = j + 2 - 12 * l;
		i = 100 * (n - 49) + i + l;

		year = i;
		month = j;
		day = k;
		const date = new Date(year, month, day);
		date.setMonth(date.getMonth() - 1);
		return date;
	}
	private static getTypeName(type: string): string {
		let typeName = "string";
		try {
			switch (type.trim().toLowerCase()) {
				case "v":
				case "c":
					typeName = "string";
					break;
				case "d":
					typeName = "date";
					break;
				case "y":
				case "i":
				case "g":
				case "b":
				case "f":
				case "n":
					typeName = "numeric";
					break;
				case "l":
					typeName = "boolean";
					break;
				case "t":
					typeName = "datetime";
					break;
				case "m":
					typeName = "memo";
					break;
				// case "q": typeName = "binary";
				//     break;
				default:
					typeName = "notsupported";
			}
		} catch (error) {
			console.log(error);
		}
		return typeName;
	}
	/**
	 * read Dbase DB File
	 */
	public static read(dbaseFile: Buffer, memoFile?: MemoFile): DataTable {
		const dt = new DataTable();
		try {
			let byteRead = 0;
			// let dbfFileType: string = Buffer.from(dbaseFile.buffer, byteRead, 1).toString('hex');
			byteRead = byteRead + 1;
			// let year: string = Buffer.from(dbaseFile.buffer, byteRead, 1).toString('ascii');
			byteRead = byteRead + 1;
			// let month: string = Buffer.from(dbaseFile.buffer, byteRead, 1).toString('ascii');
			byteRead = byteRead + 1;
			// let day: string = Buffer.from(dbaseFile.buffer, byteRead, 1).toString('ascii');
			byteRead = byteRead + 1;
			// let lastUpdDate: string = year + month + day;
			const recordCount: number = dbaseFile.readInt32LE(byteRead);
			byteRead = byteRead + 4;
			const recordDataStartOffset: number = dbaseFile.readInt16LE(byteRead);
			byteRead = byteRead + 8;
			// let recordSize: number = dbaseFile.readInt16LE(byteRead);
			byteRead = byteRead + 8;

			const fields: Array<any> = DbfReader.readFieldsInfo(dbaseFile);
			byteRead = recordDataStartOffset + 1;

			fields.forEach((f) => {
				const dataColumn: Column = new Column();
				dataColumn.name = f.fieldName;
				dataColumn.type = DbfReader.getTypeName(f.fieldType);
				if (dataColumn.type !== "notsupported") {
					dt.columns.push(dataColumn);
				}
			});
			byteRead = recordDataStartOffset;
			for (let i = 0; i < recordCount; i++) {
				const row: any = {};
				if (
					Buffer.from(dbaseFile.subarray(byteRead, byteRead + 1)).toString(
						"utf8",
					) === " "
				) {
					byteRead = byteRead + 1;
					fields.forEach((col) => {
						const type = DbfReader.getTypeName(col.fieldType);
						if (col.fieldLength < 0) {
							col.fieldLength = 256 + col.fieldLength;
						}
						if (col.fieldLength > 0) {
							const value: any = DbfReader.getFieldValue(
								Buffer.from(
									dbaseFile.subarray(byteRead, byteRead + col.fieldLength),
								),
								col.fieldType,
								col.fieldDecimalCount,
								col.fieldLength,
							);
							if (type !== "notsupported") {
								if (type === "memo") {
									if (memoFile) {
										const memoValue = memoFile.readBlock(value);
										row[col.fieldName] = memoValue;
									} else {
										row[col.fieldName] = "Memo file not found";
									}
								} else {
									row[col.fieldName] = value;
								}
								
							}
							byteRead = byteRead + col.fieldLength;
						} else {
							throw new SyntaxError("Unsupported Dbase (.dbf) file");
						}
					});
					dt.rows.push(row);
				} else {
					byteRead = byteRead + 1;
					fields.forEach((col) => {
						byteRead = byteRead + col.fieldLength;
					});
				}
			}
			return dt;
		} catch (error) {
			throw error;
		}
	}
	private static FieldDescriptor = class {
		fieldName: string;
		fieldType: string;
		fieldLength: number;
		fieldDecimalCount: number;
		constructor(
			fieldName: string,
			fieldType: string,
			fieldLength: number,
			fieldDecimalCount: number,
		) {
			this.fieldName = fieldName;
			this.fieldType = fieldType;
			this.fieldLength = fieldLength;
			this.fieldDecimalCount = fieldDecimalCount;
		}
	};
}
