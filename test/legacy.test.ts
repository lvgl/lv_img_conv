/* Tests that output matches the legacy converter */

import fs from 'fs';
import { ImageMode, OutputMode } from "../lib/enums";
import { convertImageBlob, isNotRaw } from "../lib/convert";
import { convert } from '../lib/cli_helpers';

const legacyModes: string[] = [
    "CF_ALPHA_1_BIT",
    "CF_ALPHA_2_BIT",
    "CF_ALPHA_4_BIT",
    "CF_ALPHA_8_BIT",
    "CF_INDEXED_1_BIT",
    "CF_INDEXED_2_BIT",
    "CF_INDEXED_4_BIT",
    "CF_INDEXED_8_BIT",
    "CF_RAW",
    "CF_RAW_CHROMA",
    "CF_RAW_ALPHA",
    "CF_TRUE_COLOR",
    "CF_TRUE_COLOR_ALPHA",
    "CF_TRUE_COLOR_CHROMA"
];

test.each(legacyModes)("compare with legacy %s behavior", async(cf) => {
    expect.assertions(1);
    const newFile = await convert(__dirname + "/test.png", {
        binaryFormat: null,
        outputFormat: OutputMode.C,
        outName: "test_image", 
        swapEndian: false,
        cf: ImageMode[cf],
        useLegacyFooterOrder: isNotRaw({ cf: ImageMode[cf] }) /* different for coverage */
    });
    expect(newFile).toMatchSnapshot();
});