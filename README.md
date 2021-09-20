# Image converter for LVGL

How to install:

1. Make sure Node.js is installed.
2. Clone this repository.
3. Run `npm install` to install needed dependencies.

Example usage:

```sh
# C format
./lv_img_conv.js logo_lvgl.png -f -c CF_TRUE_COLOR_ALPHA
# Binary format (RGB565)
./lv_img_conv.js logo_lvgl.png -f -c CF_TRUE_COLOR_ALPHA -t bin --binary-format 565
```

A file called `logo_lvgl.c` will be created in the same directory.

## Attribution

This converter was originally created by @embeddedt as an attempt to solve some of the common issues experienced with the PHP converter, such as running out of memory on large images or failing to read certain PNGs correctly.

Much of the actual conversion logic remains unchanged from the previous implementation, which can be found at https://github.com/lvgl/lv_utils/blob/master/img_conv_core.php.
