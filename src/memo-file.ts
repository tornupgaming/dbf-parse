import fs from "fs";

const MEMO_HEADER_LENGTH = 512;
const BLOCK_HEADER_LENGTH = 8;

export class MemoFile {
	private fd: number;
	private blockSize: number;
	private totalBlocks: number;

	constructor(filePath: string) {
		this.fd = fs.openSync(filePath, "r");
		const headerBuf = this.readBytes(0, MEMO_HEADER_LENGTH);
		this.totalBlocks = headerBuf.readUIntBE(0, 4);
		this.blockSize = headerBuf.readUIntBE(4, 4);
	}

	readAll() {
		const blocks: string[] = [];
		for (let i = 0; i < this.totalBlocks; i++) {
			blocks.push(this.readBlock(i));
		}
		return blocks;
	}

	readBlock(blockIndex: number) {
		try {
			const blockStart = blockIndex * this.blockSize;
			const blockBuffer = this.readBytes(blockStart, BLOCK_HEADER_LENGTH);
			const recordType = blockBuffer.readUIntBE(0, 4);
			if (recordType !== 0 && recordType !== 1) return "";
			const recordLength = blockBuffer.readUIntBE(4, 4);
			const blockContentStart = blockStart + BLOCK_HEADER_LENGTH;
			const blockContentBuffer = this.readBytes(
				blockContentStart,
				recordLength,
			);
			return blockContentBuffer.toString("utf-8");
		} catch (error) {
			return "";
		}
	}

	readBytes(offset: number, length: number) {
		const buffer = Buffer.alloc(length);
		fs.readSync(this.fd, buffer, 0, length, offset);
		return buffer;
	}

	close() {
		fs.closeSync(this.fd);
	}
}
