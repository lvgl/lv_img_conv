/* implement suggestions from https://forum.littlevgl.com/t/a-little-extension-to-image-converter/1902 */

import convert from './convert';
import { ImageMode } from './enums';
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
        description: 'allow overwriting input file'
    })
    .option('color-format', {
        alias: 'c',
        demandOption: true,
        description: 'color format of image',
        choices: Object.keys(ImageMode).filter((v) => (isNaN(v as any) && !v.startsWith("ICF"))) /* skip internal formats */
    })
    .argv


function getFileName(imagePath) {
    var lastDotPos = imagePath.lastIndexOf(".");
    if(lastDotPos < 0)
        lastDotPos = imagePath.length;
    
    return imagePath.substr(0, lastDotPos);
}
function getCFilePath(imagePath) {
    return getFileName(imagePath) + '.c';
}
async function convertAllImages() {
    if(argv.o && argv._.length > 1) {
        console.error("Error: only one image can be converted at a time when -o is specified.");
        process.exit(1);
    }
    for(const imagePath of argv._) {
        console.log("Beginning conversion of " + imagePath);
        const imageName = argv.i ? argv.i : getFileName(path.basename(imagePath));
        const cFileString = await convert(imagePath, { cf: ImageMode[argv["color-format"]], imageName: imageName });
        const outputPath: string = (argv.o ? argv.o : getCFilePath(imagePath)) as any;
        if(fs.existsSync(outputPath)) {
            if(argv.f) {
                console.log("overwriting " + outputPath);
            } else {
                console.error("Error: refusing to overwrite " + outputPath + " without -f specified.");
                process.exit(1);
            }
        }
        fs.writeFileSync(outputPath, cFileString);
    }
}



convertAllImages();
