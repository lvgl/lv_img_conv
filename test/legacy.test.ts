/* Tests that output matches the legacy converter */

import fs from 'fs';
import { ImageMode, OutputMode } from "../lib/enums";
import convert, { convertImageBlob, isNotRaw } from "../lib/convert";

const modes = Object.keys(ImageMode).filter(val => {
    if(isNaN(Number(val))) {
        /* It's a string */
        if(!val.startsWith("ICF_"))
            return true;
    }
    return false;
})

test.each(modes)("compare with legacy %s behavior", async(cf) => {
    let newFile;
    expect.assertions(1);
    if(isNotRaw({ cf: ImageMode[cf] })) {
        newFile = await convert(__dirname + "/test.png", {
            binaryFormat: null,
            outputFormat: OutputMode.C,
            outName: "test_image", 
            swapEndian: false,
            cf: ImageMode[cf],
            useLegacyFooterOrder: true
        });
    } else {
        newFile = await convertImageBlob(fs.readFileSync(__dirname + "/test.png"), {
            binaryFormat: null,
            outputFormat: OutputMode.C,
            outName: "test_image", 
            swapEndian: false,
            cf: ImageMode[cf],
            useLegacyFooterOrder: false /* different for coverage */
        });
    }
    expect(newFile).toMatchSnapshot();
});