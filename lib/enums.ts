enum ImageMode {
    RGB565,
    RGB565A8,
    RGB888,
    XRGB8888,
    ARGB8888,
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
