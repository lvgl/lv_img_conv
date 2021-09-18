enum ImageMode {
    ICF_TRUE_COLOR_332 = 0,      /*Helper formats. Used internally*/
    ICF_TRUE_COLOR_565 = 1,
    ICF_TRUE_COLOR_565_SWAP = 2,
    ICF_TRUE_COLOR_888 = 3,
    CF_ALPHA_1_BIT = 4,
    CF_ALPHA_2_BIT = 5,
    CF_ALPHA_4_BIT = 6,
    CF_ALPHA_8_BIT = 7,
    CF_INDEXED_1_BIT = 8,
    CF_INDEXED_2_BIT = 9,
    CF_INDEXED_4_BIT = 10,
    CF_INDEXED_8_BIT = 11,
    CF_RAW = 12,
    CF_RAW_ALPHA = 13,
    CF_RAW_CHROMA = 12,

    CF_TRUE_COLOR = 100,          /*Helper formats is C arrays contains all treu color formats (usin in "download")*/
    CF_TRUE_COLOR_ALPHA = 101,
    CF_TRUE_COLOR_CHROMA = 102,
};

enum OutputMode {
    C,
    BIN
}


const BINARY_FORMAT_PREFIX = "ICF_TRUE_COLOR_";

export { ImageMode, OutputMode, BINARY_FORMAT_PREFIX };