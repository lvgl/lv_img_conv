enum ImageMode {
    ICF_TRUE_COLOR_332,      /*Helper formats. Used internally*/
    ICF_TRUE_COLOR_565,
    ICF_TRUE_COLOR_565_SWAP,
    ICF_TRUE_COLOR_888,
    CF_ALPHA_1_BIT,
    CF_ALPHA_2_BIT,
    CF_ALPHA_4_BIT,
    CF_ALPHA_8_BIT,
    CF_INDEXED_1_BIT,
    CF_INDEXED_2_BIT,
    CF_INDEXED_4_BIT,
    CF_INDEXED_8_BIT,
    CF_RAW,
    CF_RAW_CHROMA = CF_RAW,
    CF_RAW_ALPHA,

    CF_TRUE_COLOR,          /*Helper formats is C arrays contains all treu color formats (usin in "download")*/
    CF_TRUE_COLOR_ALPHA,
    CF_TRUE_COLOR_CHROMA,
};

class ImageModeUtil {
    public static isTrueColor(mode: string|ImageMode) {
        if(typeof mode != 'string')
            mode = ImageMode[mode];
        return mode.startsWith("CF_TRUE_COLOR");
    }
}

enum OutputMode {
    C,
    BIN
}


const BINARY_FORMAT_PREFIX = "ICF_TRUE_COLOR_";

export { ImageMode, ImageModeUtil, OutputMode, BINARY_FORMAT_PREFIX };