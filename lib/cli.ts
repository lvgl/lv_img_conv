/* implement suggestions from https://forum.littlevgl.com/t/a-little-extension-to-image-converter/1902 */

import convert from './convert';
import { ImageMode, OutputMode, BINARY_FORMAT_PREFIX } from './enums';
import fs from 'fs';
import path from 'path';

import yargs from 'yargs';

const argv = yargs
    .option('output-file', {
        alias: 'o',
        type: 'string',
        description: 'output file path (for single-image conversion)'
    })
    .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'allow overwriting the output file'
    })
    .option('color-format', {
        alias: 'c',
        demandOption: true,
        description: 'color format of image',
        choices: Object.keys(ImageMode).filter((v) => (isNaN(v as any) && !v.startsWith("ICF"))) /* skip internal formats */
    })
    .option('output-format', {
        alias: 't',
        description: 'output format of image',
        choices: [ 'c', 'bin' ],
        default: 'c'
    })
    .option('binary-format', {
        description: 'binary color format (needed if output-format is binary)',
        string: true,
        choices: Object.keys(ImageMode).filter((v) => (isNaN(v as any) && v.startsWith(BINARY_FORMAT_PREFIX))).map(v => v.substring(BINARY_FORMAT_PREFIX.length)) /* skip internal formats */
    })
    .option('swap-endian', {
        alias: 's',
        type: 'boolean',
        description: 'swap endian of image'
    })
    .argv


function getFileName(imagePath) {
    var lastDotPos = imagePath.lastIndexOf(".");
    if(lastDotPos < 0)
        lastDotPos = imagePath.length;
    
    return imagePath.substr(0, lastDotPos);
}
function getCFilePath(imagePath, outputMode) {
    return getFileName(imagePath) + '.' + (outputMode == OutputMode.C ? 'c' : 'bin');
}
async function convertAllImages() {
    if(argv.o && argv._.length > 1) {
        console.error("Error: only one image can be converted at a time when -o is specified.");
        process.exit(1);
    }
    const outputMode = OutputMode[(argv.t as string).toUpperCase()];
    const binaryFormat = argv["binary-format"];
    if(typeof outputMode == 'undefined') {
        console.error("Invalid output mode");
        process.exit(1);
    }
    if(outputMode == OutputMode.BIN && typeof binaryFormat == 'undefined') {
        console.error("--binary-format must be specified");
        process.exit(1);
    }
    for(const imagePath of argv._) {
        console.log("Beginning conversion of " + imagePath);
        const imageName = argv.i ? argv.i : getFileName(path.basename(imagePath));
        const cFileString = await convert(imagePath, { cf: ImageMode[argv["color-format"]], outputFormat: outputMode, binaryFormat: ImageMode[BINARY_FORMAT_PREFIX + binaryFormat], swapEndian: argv.s, imageName: imageName });
        const outputPath: string = (argv.o ? argv.o : getCFilePath(imagePath, outputMode)) as any;
        if(fs.existsSync(outputPath)) {
            if(argv.f) {
                console.log("overwriting " + outputPath);
            } else {
                console.error("Error: refusing to overwrite " + outputPath + " without -f specified.");
                process.exit(1);
            }
        }
        if(typeof cFileString == 'string')
            fs.writeFileSync(outputPath, cFileString);
        else
            fs.writeFileSync(outputPath, new Uint8Array(cFileString as ArrayBuffer));
    }
}



convertAllImages();
