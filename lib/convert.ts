import { createCanvas, Image } from 'canvas';
import { ImageMode, ImageModeUtil, OutputMode } from './enums';
import { buildPalette, utils, applyPalette, distance, image } from './image-q/image-q';
import { round_half_up, str_pad, dechex } from './helpers';

export interface ConverterOptions {
    cf: ImageMode;
    outName: string;
}
class Converter {
    w = 0;         /*Image width*/
    h = 0;         /*Image height*/
    raw_len = 0; /* RAW image data size */
    cf: ImageMode;        /*Color format*/
    outputFormat: OutputMode;
    alpha = false;     /*Add alpha byte or not*/
    d_out: Array<number>;     /*Output data (result)*/
    imageData: Array<number>|Uint8Array; /* Input image data */
    options: ConverterOptions;

    /*Helper variables*/
    r_act: number;
    b_act: number;
    g_act: number;

    /* Current pass being made */
    pass: number;

    constructor(w: number, h: number, imageData, alpha: boolean, options: Partial<ConverterOptions>) {
        this.w = w;
        this.h = h;
        this.imageData = imageData;
        this.pass = 0;
        this.cf = options.cf;
        this.alpha = alpha;
        this.outputFormat = options.outputFormat;
        this.options = options as ConverterOptions;
    }

    /**
     * Get the number of passes being made over an image to output it.
     */
    getNumPasses() {
        if(this.cf == ImageMode.RGB565A8)
            return 2;
        else
            return 1;
    }

    async convert(): Promise<string|ArrayBuffer> {
        if(this.cf == ImageMode.RAW || this.cf == ImageMode.RAW_ALPHA) {
            const d_array = Array.from((this.imageData as Uint8Array));
            this.raw_len = d_array.length;
            const indent = this.options.useLegacyFooterOrder ? "  ": "    ";
            const numValuesPerRow = this.options.useLegacyFooterOrder ? 15 : 12;
            let str = "\n" + indent + d_array.map((val, i) => "0x" + str_pad(dechex(val), 2, '0', true) + ((i % (numValuesPerRow+1)) == numValuesPerRow ? (", \n" + indent) : ", ")).join("");
            str = str.substr(0, str.length-2);
            return str;
        }
        
        this.d_out = [];
        for(this.pass = 0; this.pass < this.getNumPasses(); this.pass++) {
            /*Convert all the pixels*/
            for(var y = 0; y < this.h; y++) {
                for(var x = 0; x < this.w; ++x){
                    this.conv_px(x, y);
                }
            }
        }
        
        return this.format_to_c_array(); 
    }

    get_c_header(out_name: string): string {
        var $c_header =
        `#ifdef __has_include
    #if __has_include("lvgl.h")
        #ifndef LV_LVGL_H_INCLUDE_SIMPLE
            #define LV_LVGL_H_INCLUDE_SIMPLE
        #endif
    #endif
#endif

#if defined(LV_LVGL_H_INCLUDE_SIMPLE)
    #include "lvgl.h"
#else
    #include "lvgl/lvgl.h"
#endif


#ifndef LV_ATTRIBUTE_MEM_ALIGN
#define LV_ATTRIBUTE_MEM_ALIGN
#endif

`;
        var $attr_name = "LV_ATTRIBUTE_IMAGE_" + out_name.toUpperCase(); 
        $c_header += 
`#ifndef ${$attr_name}
#define ${$attr_name}
#endif

const LV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST ${$attr_name} uint8_t ` + out_name+ "_map[] = {";

        return $c_header;
    }

    static imagemode_to_enum_name($cf: ImageMode): string {
        return "LV_COLOR_FORMAT_" + ImageMode[$cf];
    }

    get_c_footer($cf, out_name) {
        var header_cf = Converter.imagemode_to_enum_name($cf);
        var data_size;

        switch($cf) {
            case ImageMode.RGB565:
                data_size = this.w * this.h + " * 2";
                break;
            case ImageMode.RGB565A8:
            case ImageMode.RGB888:
                data_size = this.w * this.h + " * 3";
                break;
            case ImageMode.XRGB8888:
            case ImageMode.ARGB8888:
                data_size = this.w * this.h + " * 4";
                break;
            case ImageMode.RAW:
            case ImageMode.RAW_ALPHA:
                data_size = this.raw_len;
                break;
            default:
                throw new Error("unexpected color format " + ImageMode[$cf]);
        }

        var $c_footer;
            $c_footer = `\n};\n
const lv_image_dsc_t ${out_name} = {
  .header.cf = ${header_cf},
  .header.magic = LV_IMAGE_HEADER_MAGIC,
  .header.w = ${this.w},
  .header.h = ${this.h},
  .data_size = ${data_size},
  .data = ${out_name}_map,
};\n`;

        return $c_footer;
    }


    private conv_px(x, y) {
        function array_push<T>(arr: Array<T>, v: T) {
            arr.push(v);
        }
        function isset(val: any): boolean {
            return typeof val != 'undefined' && val != undefined;
        }
        const startIndex = ((y*this.w)+x)*4;
        let a;
        if(this.alpha){
            a = this.imageData[startIndex+3];
        } else {
            a = 0xff;
        }
        const r = this.imageData[startIndex];
        const g = this.imageData[startIndex+1];
        const b = this.imageData[startIndex+2];

        const c = this.imageData[((y*this.w)+x)];

        /* Populate r_act, g_act, b_act */
        this.dith_next(r, g, b, x);

        if(this.cf == ImageMode.RGB565) {
            const c16 = ((this.r_act) << 8) | ((this.g_act) << 3) | ((this.b_act) >> 3);	//RGR565
            array_push(this.d_out, c16 & 0xFF);
            array_push(this.d_out, (c16 >> 8) & 0xFF);
        }
        else if(this.cf == ImageMode.RGB888) {
            array_push(this.d_out, this.b_act);
            array_push(this.d_out, this.g_act);
            array_push(this.d_out, this.r_act);
        }
        else if(this.cf == ImageMode.XRGB8888) {
            array_push(this.d_out, this.b_act);
            array_push(this.d_out, this.g_act);
            array_push(this.d_out, this.r_act);
            array_push(this.d_out, 0xff);
        }
        else if(this.cf == ImageMode.ARGB8888) {
            array_push(this.d_out, this.b_act);
            array_push(this.d_out, this.g_act);
            array_push(this.d_out, this.r_act);
            array_push(this.d_out, a);
        } 
        else if(this.cf == ImageMode.RGB565A8) {
            if(this.pass == 0) {
                const c16 = ((this.r_act) << 8) | ((this.g_act) << 3) | ((this.b_act) >> 3);	//RGR565
                array_push(this.d_out, c16 & 0xFF);
                array_push(this.d_out, (c16 >> 8) & 0xFF);
            } else if(this.pass == 1) {
                array_push(this.d_out, a);
            }
        }
	}

    dith_next(r, g, b, x) {
        if(this.cf == ImageMode.RGB565 || this.cf == ImageMode.RGB565A8) {
            this.r_act = this.classify_pixel(r, 5);
            this.g_act = this.classify_pixel(g, 6);
            this.b_act = this.classify_pixel(b, 5);

            if(this.r_act > 0xF8) this.r_act = 0xF8;
            if(this.g_act > 0xFC) this.g_act = 0xFC;
            if(this.b_act > 0xF8) this.b_act = 0xF8;

        } else if(this.cf == ImageMode.ARGB8888 || this.cf == ImageMode.XRGB8888 || this.cf == ImageMode.RGB888) {
            this.r_act = this.classify_pixel(r, 8);
            this.g_act = this.classify_pixel(g, 8);
            this.b_act = this.classify_pixel(b, 8);

            if(this.r_act > 0xFF) this.r_act = 0xFF;
            if(this.g_act > 0xFF) this.g_act = 0xFF;
            if(this.b_act > 0xFF) this.b_act = 0xFF;
        }
    }

    classify_pixel(value, bits) {
      const tmp = 1 << (8 - bits);
      let val = Math.round(value / tmp) * tmp;
      if(val < 0) val = 0;
      return val;
    }

    format_to_c_array() {
        let c_array = "";
        var i = 0;
        let y_end = this.h;
        let x_end = this.w;

        for(var y = 0; y < y_end; y++) {
            c_array += "\n  ";
            for(var x = 0; x < x_end; x++) {
                if(this.cf == ImageMode.RGB565) {
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', true) + ", ";
                    c_array += "0x" + str_pad(dechex(this.d_out[i+1]), 2, '0', true) + ", ";
                    i += 2;
                }
                else if(this.cf == ImageMode.RGB565A8) {
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', true) + ", ";
                    c_array += "0x" + str_pad(dechex(this.d_out[i+1]), 2, '0', true) + ", ";
                    i += 2;
                }
                else if(this.cf == ImageMode.RGB888) {
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', true) + ", ";
                    c_array += "0x" + str_pad(dechex(this.d_out[i+1]), 2, '0', true) + ", ";
                    c_array += "0x" + str_pad(dechex(this.d_out[i+2]), 2, '0', true) + ", ";
                    i += 3;
                }
                else if(this.cf == ImageMode.XRGB8888 || this.cf == ImageMode.ARGB8888) {
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', true) + ", ";
                    c_array += "0x" + str_pad(dechex(this.d_out[i+1]), 2, '0', true) + ", ";
                    c_array += "0x" + str_pad(dechex(this.d_out[i+2]), 2, '0', true) + ", ";
                    c_array += "0x" + str_pad(dechex(this.d_out[i+3]), 2, '0', true) + ", ";
                    i += 4;
                }
            }
        }

        if(this.cf == ImageMode.RGB565A8) {
            c_array += "\n";
            for(var y = 0; y < y_end; y++) {
                c_array += "\n  ";
                for(var x = 0; x < x_end; x++) {
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', true) + ", ";
                    i += 1;
                }
            }
        }

        return c_array;
    }
}


export function isNotRaw(options: { cf: ImageMode; }): boolean {
    return options.cf != ImageMode.RAW && options.cf != ImageMode.RAW_ALPHA; 
}

async function convertImageBlob(img: Image|Uint8Array, options: Partial<ConverterOptions>): Promise<string|ArrayBuffer> {
    function isImage(img, options): img is Image {
        return isNotRaw(options);
    }
    let c_res_array: string;
    let bin_res_blob: ArrayBuffer;
    const out_name = options.outName;
    const outputFormat: OutputMode = options.outputFormat;
    let c_creator: Converter;

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

    const alpha = (options.cf == ImageMode.RGB565A8 || options.cf == ImageMode.ARGB8888);
    c_creator = new Converter(img.width, img.height, imageData, alpha, options);
    c_res_array = await c_creator.convert() as string;
    
    return c_creator.get_c_header(out_name) + c_res_array + c_creator.get_c_footer(options.cf, out_name);
}

export { convertImageBlob, Converter };
