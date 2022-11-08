# Image converter for LVGL

## How to install

1. Make sure Node.js is installed.
1. Not always needed, but recommended: ensure the necessary [native dependencies for canvas](https://github.com/Automattic/node-canvas#compiling) are installed.
1. Clone this repository.
1. Run `npm install` to install needed dependencies.

**NOTE: For Docker instructions skip ahead**

### Extra steps for Windows
1. Run 'npm install -g typescript'
1. Move to 'lib' folder 'cd lib'
1. Run 'npm install -g ts-node'

**Note**: The converter might fail on Windows if the file path containes multiple byte characters (Chinese/Japanese/Korean characters etc.). It's recommended to rename these files before passing them to the converter, or you can switch on `enable Beta:Use Unicode UTF-8 for worldwide language support` options.

## Example usage:
For Linux:
```sh
# C format
./lv_img_conv.js logo_lvgl.png -f -c CF_TRUE_COLOR_ALPHA
# Binary format (RGB565)
./lv_img_conv.js logo_lvgl.png -f -c CF_TRUE_COLOR_ALPHA -t bin --binary-format 565
# C format with dither algoritm
./lv_img_conv.js logo_lvgl.png -f -d true -c CF_TRUE_COLOR_ALPHA
```

For Windows:
```sh
# C format
ts-node cli.ts logo_lvgl.png -f -c CF_TRUE_COLOR_ALPHA
# Binary format (RGB565)
ts-node cli.ts logo_lvgl.png -f -c CF_TRUE_COLOR_ALPHA -t bin --binary-format 565
# C format with dither algoritm
ts-node cli.ts logo_lvgl.png -f -d true -c CF_TRUE_COLOR_ALPHA
```

A file called `logo_lvgl.c` will be created in the same directory.

## Example usage with Docker:

### Building locally

```bash
docker build -t lv_img_conv .
```

### Run lv_img_conv.js directly

```bash
docker run --rm \
    -u 1000:1000 \
    -v /path/to/project:/usr/src/proj \
    lv_img_conv \
    <lv_img_conv.js arguments>
```

### Run interactive shell

```bash
docker run -it --rm \
    -u 1000:1000 \
    -v /path/to/project:/usr/src/proj \
    lv_img_conv
```

`lv_img_conv.js` is in the `$PATH` and callable from the interactive shell.

### Parameters

| Parameter | Function |
| --- | --- |
| `-u 1000:1000` | Set to your host user's UID/GID, unless you don't mind root ownership on output files |
| `-v /path/to/project:/usr/src/proj` | Change `/path/to/project` to directory with image(s) to convert |

## Attribution

This converter was originally created by @embeddedt as an attempt to solve some of the common issues experienced with the PHP converter, such as running out of memory on large images or failing to read certain PNGs correctly.

Much of the actual conversion logic remains unchanged from the previous implementation, which can be found at https://github.com/lvgl/lv_utils/blob/b298fe71675e9c12016adabcc8889394b477b89b/img_conv_core.php.
