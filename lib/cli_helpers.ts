import { convertImageBlob, isNotRaw, ConverterOptions } from './convert';
import { Image, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

export async function convert(imagePath, options: ConverterOptions) {
    let img: Image|Uint8Array;
    let overrideWidth, overrideHeight;
    if(isNotRaw(options))
        img = await loadImage(imagePath);
    else {
        img = fs.readFileSync(imagePath);
        try {
            const tempImage = await loadImage(imagePath);
            overrideWidth = tempImage.width;
            overrideHeight = tempImage.height;
        } catch(e) {
            console.warn("warning: unable to derive width and height of this image, they will be set to 0");
        }
    }
    return convertImageBlob(img, Object.assign({}, options, { outName: options.outName || path.parse(imagePath).name, overrideWidth, overrideHeight }));
    
}