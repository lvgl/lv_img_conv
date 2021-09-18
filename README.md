# Image converter for LVGL

`lv_img_conv` is a new image converter for LVGL, designed to replace the previous PHP converter at https://github.com/lvgl/lv_utils/blob/master/img_conv_core.php.

To use it:

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
