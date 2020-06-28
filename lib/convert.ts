import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { ImageMode } from './enums';
import round from 'locutus/php/math/round';
import dechex from 'locutus/php/math/dechex';
import str_pad from 'locutus/php/strings/str_pad';
import count from 'locutus/php/array/count';
import { buildPalette, utils, applyPalette, distance, image } from 'image-q';
import { idate } from 'locutus/php/datetime';

class Converter {
    dith = false;      /*Dithering enable/disable*/
    w = 0;         /*Image width*/
    h = 0;         /*Image height*/
    cf: ImageMode;        /*Color format*/
    alpha = false;     /*Add alpha byte or not*/
    chroma = false;    /*Chroma keyed?*/
    d_out: Array<number>;     /*Output data (result)*/
    imageData: Array<number>; /* Input image data */

    /*Helper variables*/
    r_act: number;
    b_act: number;
    g_act: number;

    /*For dithering*/
    r_earr: Array<number>;  /*Classification error for next row of pixels*/
    g_earr: Array<number>;
    b_earr: Array<number>;

    r_nerr: number;  /*Classification error for next pixel*/
    g_nerr: number;
    b_nerr: number;


    constructor(w, h, imageData, dith, cf, alpha) {
        this.dith = dith;
        this.w = w;
        this.h = h;
        this.imageData = imageData;
        this.r_earr = [];  /*Classification error for next row of pixels*/
        this.g_earr = [];
        this.b_earr = [];

        if(this.dith) {
            for(var i = 0; i < this.w + 2; ++i){
                this.r_earr[i] = 0;
                this.g_earr[i] = 0;
                this.b_earr[i] = 0;
            }
        }

        this.r_nerr = 0;  /*Classification error for next pixel*/
        this.g_nerr = 0;
        this.b_nerr = 0;
        this.cf = cf;
        this.alpha = alpha;
    }

    async convert() {

        var palette_size = 0, bits_per_value = 0;
        if(this.cf == ImageMode.CF_INDEXED_1_BIT) {
            palette_size = 2;
            bits_per_value = 1;
        } else if(this.cf == ImageMode.CF_INDEXED_2_BIT) {
            palette_size = 4;
            bits_per_value = 2;
        } else if(this.cf == ImageMode.CF_INDEXED_4_BIT) {
            palette_size = 16;
            bits_per_value = 4;
        } else if(this.cf == ImageMode.CF_INDEXED_8_BIT) {
            palette_size = 256;
            bits_per_value = 8;
        }
        this.d_out = [];

        if(palette_size) {
            const pointContainer = utils.PointContainer.fromUint8Array(this.imageData, this.w, this.h);
            const palette = await buildPalette([pointContainer], {
                colors: palette_size, // optional
            });
            const color_arr = this.d_out;
            const palettePointArray = palette.getPointContainer().getPointArray();
            const paletteColors = palettePointArray.map((point) => {
                return point.uint32;
            });
            for(var i = 0; i < palette_size; i++) {
                if(i < palettePointArray.length) {
                    color_arr.push(palettePointArray[i].b, palettePointArray[i].g, palettePointArray[i].r, palettePointArray[i].a);
                } else {
                    color_arr.push(0, 0, 0, 0);
                }
            }

            const outPointContainer = await applyPalette(pointContainer, palette, {
            });
            let currentValue = 0;
            let numBitsShifted = 0;
            const outPointArray = outPointContainer.getPointArray();
            this.imageData = [];
            outPointArray.forEach((point, arrayIndex) => {
                const index = paletteColors.indexOf(point.uint32);
                if(index == -1)
                    throw new Error("Unknown color??");
                this.imageData.push(index);
            });
        }

        

        /*Convert all the pixels*/
        for(var y = 0; y < this.h; y++) {
            this.dith_reset();

            for(var x = 0; x < this.w; ++x){
                this.conv_px(x, y);
            }
        }

        return this.format_to_c_array();
    }

    get_c_header(out_name: string): string {
        var $c_header =
        `#include \"lvgl/lvgl.h\"

#ifndef LV_ATTRIBUTE_MEM_ALIGN
#define LV_ATTRIBUTE_MEM_ALIGN
#endif
`;
        var $attr_name = "LV_ATTRIBUTE_IMG_" + out_name.toUpperCase(); 
        $c_header += 
`#ifndef ${$attr_name}
#define ${$attr_name}
#endif
const LV_ATTRIBUTE_MEM_ALIGN ${$attr_name} uint8_t ` + out_name+ "_map[] = {";

        return $c_header;
    }

    get_c_footer($cf, out_name) {
        var $c_footer =
        `\n};\n
const lv_img_dsc_t ${out_name} = {
  .header.always_zero = 0,
  .header.w = ${this.w},
  .header.h = ${this.h},\n`;

    if($cf == ImageMode.CF_TRUE_COLOR) $c_footer += "  .data_size = " + this.w * this.h + " * LV_COLOR_SIZE / 8,\n  .header.cf = LV_IMG_CF_TRUE_COLOR,";
    else if($cf == ImageMode.CF_TRUE_COLOR_ALPHA) $c_footer += "  .data_size = " + this.w * this.h + " * LV_IMG_PX_SIZE_ALPHA_BYTE,\n  .header.cf = LV_IMG_CF_TRUE_COLOR_ALPHA,";
    else if($cf == ImageMode.CF_TRUE_COLOR_CHROMA) $c_footer += "  .data_size = " + this.w * this.h + " * LV_COLOR_SIZE / 8,\n  .header.cf = LV_IMG_CF_TRUE_COLOR_CHROMA_KEYED,";
    else if($cf == ImageMode.CF_ALPHA_1_BIT) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_ALPHA_1BIT,";
    else if($cf == ImageMode.CF_ALPHA_2_BIT) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_ALPHA_2BIT,";
    else if($cf == ImageMode.CF_ALPHA_4_BIT) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_ALPHA_4BIT,";
    else if($cf == ImageMode.CF_ALPHA_8_BIT) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_ALPHA_8BIT,";
    else if($cf == ImageMode.CF_INDEXED_1_BIT) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_INDEXED_1BIT,";
    else if($cf == ImageMode.CF_INDEXED_2_BIT) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_INDEXED_2BIT,";
    else if($cf == ImageMode.CF_INDEXED_4_BIT) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_INDEXED_4BIT,";
    else if($cf == ImageMode.CF_INDEXED_8_BIT) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_INDEXED_8BIT,";
    else if($cf == ImageMode.CF_RAW) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_RAW,";
    else if($cf == ImageMode.CF_RAW_ALPHA) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_RAW_ALPHA,";
    else if($cf == ImageMode.CF_RAW_CHROMA) $c_footer += "  .data_size = " + count(this.d_out) + ",\n  .header.cf = LV_IMG_CF_RAW_CHROMA_KEYED,";

    $c_footer += "\n  .data = " + out_name + `_map,
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

        if(this.cf == ImageMode.ICF_TRUE_COLOR_565 || this.cf == ImageMode.ICF_TRUE_COLOR_565_SWAP || this.cf == ImageMode.ICF_TRUE_COLOR_332 || this.cf == ImageMode.ICF_TRUE_COLOR_888)
            this.dith_next(r, g, b, x);

        if(this.cf == ImageMode.ICF_TRUE_COLOR_332) {
            const c8 = (this.r_act) | (this.g_act >> 3) | (this.b_act >> 6);	//RGB332
            array_push(this.d_out, c8);
            if(this.alpha) array_push(this.d_out, a);
        } else if(this.cf == ImageMode.ICF_TRUE_COLOR_565) {
            const c16 = ((this.r_act) << 8) | ((this.g_act) << 3) | ((this.b_act) >> 3);	//RGR565
            array_push(this.d_out, c16 & 0xFF);
            array_push(this.d_out, (c16 >> 8) & 0xFF);
            if(this.alpha) array_push(this.d_out, a);
        } else if(this.cf == ImageMode.ICF_TRUE_COLOR_565_SWAP) {
            const c16 = ((this.r_act) << 8) | ((this.g_act) << 3) | ((this.b_act) >> 3);	//RGR565
            array_push(this.d_out, (c16 >> 8) & 0xFF);
            array_push(this.d_out, c16 & 0xFF);
            if(this.alpha) array_push(this.d_out, a);
        } else if(this.cf == ImageMode.ICF_TRUE_COLOR_888) {
            array_push(this.d_out, this.b_act);
            array_push(this.d_out, this.g_act);
            array_push(this.d_out, this.r_act);
            array_push(this.d_out, a);
        } else if(this.cf == ImageMode.CF_ALPHA_1_BIT) {
            let w = this.w >> 3;
            if(this.w & 0x07) w++;
            const p = w * y + (x >> 3);
            if(!isset(this.d_out[p])) {
                this.d_out[p] = 0;          /*Clear the bits first*/
            }
            if(a > 0x80) {
                this.d_out[p] |= 1 << (7 - (x & 0x7));
            }
        }
        else if(this.cf == ImageMode.CF_ALPHA_2_BIT) {
            let w = this.w >> 2;
            if(this.w & 0x03) w++;

            const p = w * y + (x >> 2);
            if(!isset(this.d_out[p])) this.d_out[p] = 0;          /*Clear the bits first*/
            this.d_out[p] |= (a >> 6) << (6 - ((x & 0x3) * 2));
        }
        else if(this.cf == ImageMode.CF_ALPHA_4_BIT) {
            let w = this.w >> 1;
            if(this.w & 0x01) w++;

            const p = w * y + (x >> 1);
            if(!isset(this.d_out[p])) this.d_out[p] = 0;          /*Clear the bits first*/
            this.d_out[p] |= (a >> 4) << (4 - ((x & 0x1) * 4));
        }
        else if(this.cf == ImageMode.CF_ALPHA_8_BIT) {
            const p = this.w * y + x;
            this.d_out[p] = a;
        }
        else if(this.cf == ImageMode.CF_INDEXED_1_BIT) {
            let w = this.w >> 3;
            if(this.w & 0x07) w++;

            const p = w * y + (x >> 3) + 8;                       // +8 for the palette
            if(!isset(this.d_out[p])) this.d_out[p] = 0;          //Clear the bits first
            this.d_out[p] |= (c & 0x1) << (7 - (x & 0x7));
        }
        else if(this.cf == ImageMode.CF_INDEXED_2_BIT) {
            let w = this.w >> 2;
            if(this.w & 0x03) w++;

            const p = w * y + (x >> 2) + 16;                              // +16 for the palette
            if(!isset(this.d_out[p])) this.d_out[p] = 0;          // Clear the bits first
            this.d_out[p] |= (c & 0x3) << (6 - ((x & 0x3) * 2));
        }
        else if(this.cf == ImageMode.CF_INDEXED_4_BIT) {
            let w = this.w >> 1;
            if(this.w & 0x01) w++;

            const p = w * y + (x >> 1) + 64;                              // +64 for the palette
            if(!isset(this.d_out[p])) this.d_out[p] = 0;          // Clear the bits first
            this.d_out[p] |= (c & 0xF) << (4 - ((x & 0x1) * 4));
        }
        else if(this.cf == ImageMode.CF_INDEXED_8_BIT) {
            const p = this.w * y + x + 1024;                              // +1024 for the palette
            this.d_out[p] = c & 0xFF;
        }
	}

    dith_reset() {
        if(this.dith){
          this.r_nerr = 0;
          this.g_nerr = 0;
          this.b_nerr = 0;
        }
    }

    dith_next(r, g, b, x) {

     if(this.dith){
        this.r_act = r + this.r_nerr + this.r_earr[x+1];
        this.r_earr[x+1] = 0;

        this.g_act = g + this.g_nerr + this.g_earr[x+1];
        this.g_earr[x+1] = 0;

        this.b_act = b + this.b_nerr + this.b_earr[x+1];
        this.b_earr[x+1] = 0;

        if(this.cf == ImageMode.ICF_TRUE_COLOR_332) {
            this.r_act = this.classify_pixel(this.r_act, 3);
            this.g_act = this.classify_pixel(this.g_act, 3);
            this.b_act = this.classify_pixel(this.b_act, 2);

            if(this.r_act > 0xE0) this.r_act = 0xE0;
            if(this.g_act > 0xE0) this.g_act = 0xE0;
            if(this.b_act > 0xC0) this.b_act = 0xC0;

        } else if(this.cf == ImageMode.ICF_TRUE_COLOR_565 || this.cf == ImageMode.ICF_TRUE_COLOR_565_SWAP) {
            this.r_act = this.classify_pixel(this.r_act, 5);
            this.g_act = this.classify_pixel(this.g_act, 6);
            this.b_act = this.classify_pixel(this.b_act, 5);

            if(this.r_act > 0xF8) this.r_act = 0xF8;
            if(this.g_act > 0xFC) this.g_act = 0xFC;
            if(this.b_act > 0xF8) this.b_act = 0xF8;

        } else if(this.cf == ImageMode.ICF_TRUE_COLOR_888) {
            this.r_act = this.classify_pixel(this.r_act, 8);
            this.g_act = this.classify_pixel(this.g_act, 8);
            this.b_act = this.classify_pixel(this.b_act, 8);

            if(this.r_act > 0xFF) this.r_act = 0xFF;
            if(this.g_act > 0xFF) this.g_act = 0xFF;
            if(this.b_act > 0xFF) this.b_act = 0xFF;
        }

        this.r_nerr = r - this.r_act;
        this.g_nerr = g - this.g_act;
        this.b_nerr = b - this.b_act;

        this.r_nerr = round((7 * this.r_nerr) / 16);
        this.g_nerr = round((7 * this.g_nerr) / 16);
        this.b_nerr = round((7 * this.b_nerr) / 16);

        this.r_earr[x] += round((3 * this.r_nerr) / 16);
        this.g_earr[x] += round((3 * this.g_nerr) / 16);
        this.b_earr[x] += round((3 * this.b_nerr) / 16);

        this.r_earr[x+1] += round((5 * this.r_nerr) / 16);
        this.g_earr[x+1] += round((5 * this.g_nerr) / 16);
        this.b_earr[x+1] += round((5 * this.b_nerr) / 16);

        this.r_earr[x+2] += round(this.r_nerr / 16);
        this.g_earr[x+2] += round(this.g_nerr / 16);
        this.b_earr[x+2] += round(this.b_nerr / 16);
      }
      else{
        if(this.cf == ImageMode.ICF_TRUE_COLOR_332) {
            this.r_act = this.classify_pixel(r, 3);
            this.g_act = this.classify_pixel(g, 3);
            this.b_act = this.classify_pixel(b, 2);

            if(this.r_act > 0xE0) this.r_act = 0xE0;
            if(this.g_act > 0xE0) this.g_act = 0xE0;
            if(this.b_act > 0xC0) this.b_act = 0xC0;

        } else if(this.cf == ImageMode.ICF_TRUE_COLOR_565 || this.cf == ImageMode.ICF_TRUE_COLOR_565_SWAP) {
            this.r_act = this.classify_pixel(r, 5);
            this.g_act = this.classify_pixel(g, 6);
            this.b_act = this.classify_pixel(b, 5);

            if(this.r_act > 0xF8) this.r_act = 0xF8;
            if(this.g_act > 0xFC) this.g_act = 0xFC;
            if(this.b_act > 0xF8) this.b_act = 0xF8;

        } else if(this.cf == ImageMode.ICF_TRUE_COLOR_888) {
            this.r_act = this.classify_pixel(r, 8);
            this.g_act = this.classify_pixel(g, 8);
            this.b_act = this.classify_pixel(b, 8);

            if(this.r_act > 0xFF) this.r_act = 0xFF;
            if(this.g_act > 0xFF) this.g_act = 0xFF;
            if(this.b_act > 0xFF) this.b_act = 0xFF;
        }
      }
    }

    classify_pixel(value, bits){
      const tmp = 1 << (8 - bits);
      let val = round(value / tmp, 0, 'PHP_ROUND_HALF_DOWN') * tmp;
      if(val < 0) val = 0;
      return val;
    }
    format_to_c_array() {

        let c_array = "";
        var i = 0;
        let y_end = this.h;
        let x_end = this.w;

        if(this.cf == ImageMode.ICF_TRUE_COLOR_332) {
            c_array += "\n#if LV_COLOR_DEPTH == 1 || LV_COLOR_DEPTH == 8";
            if(!this.alpha) c_array += "\n  /*Pixel format: Red: 3 bit, Green: 3 bit, Blue: 2 bit*/";
            else  c_array += "\n  /*Pixel format: Alpha 8 bit, Red: 3 bit, Green: 3 bit, Blue: 2 bit*/";
        } else if(this.cf == ImageMode.ICF_TRUE_COLOR_565) {
            c_array += "\n#if LV_COLOR_DEPTH == 16 && LV_COLOR_16_SWAP == 0";
            if(!this.alpha) c_array += "\n  /*Pixel format: Red: 5 bit, Green: 6 bit, Blue: 5 bit*/";
            else c_array += "\n  /*Pixel format: Alpha 8 bit, Red: 5 bit, Green: 6 bit, Blue: 5 bit*/";
        }  else if(this.cf == ImageMode.ICF_TRUE_COLOR_565_SWAP) {
            c_array += "\n#if LV_COLOR_DEPTH == 16 && LV_COLOR_16_SWAP != 0";
            if(!this.alpha) c_array +=  "\n  /*Pixel format: Red: 5 bit, Green: 6 bit, Blue: 5 bit BUT the 2 bytes are swapped*/";
            else c_array += "\n  /*Pixel format: Alpha 8 bit, Red: 5 bit, Green: 6 bit, Blue: 5 bit  BUT the 2  color bytes are swapped*/";
        }  else if(this.cf == ImageMode.ICF_TRUE_COLOR_888) {
            c_array += "\n#if LV_COLOR_DEPTH == 32";
            if(!this.alpha) c_array += "\n  /*Pixel format: Fix 0xFF: 8 bit, Red: 8 bit, Green: 8 bit, Blue: 8 bit*/";
            else "\n  /*Pixel format: Alpha 8 bit, Red: 8 bit, Green: 8 bit, Blue: 8 bit*/";
        } else if(this.cf == ImageMode.CF_INDEXED_1_BIT) {
            c_array += "\n";
            for(var p = 0; p < 2; p ++) {
                c_array += "  0x" + str_pad(dechex(this.d_out[p * 4 + 0]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 1]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 2]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 3]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += `\t/*Color of index ${p}*/\n`;
            }
    
            i = p * 4;
        }
        else if(this.cf == ImageMode.CF_INDEXED_2_BIT) {
            c_array += "\n";
            for(p = 0; p < 4; p ++) {
                c_array += "  0x" + str_pad(dechex(this.d_out[p * 4 + 0]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 1]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 2]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 3]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += `\t/*Color of index ${p}*/\n`;
            }
    
            i = p * 4;
        }
        else if(this.cf == ImageMode.CF_INDEXED_4_BIT) {
            c_array += "\n";
            for(p = 0; p < 16; p ++) {
                c_array += "  0x" + str_pad(dechex(this.d_out[p * 4 + 0]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 1]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 2]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 3]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += `\t/*Color of index ${p}*/\n`;
            }
    
            i = p * 4;
        }
        else if(this.cf == ImageMode.CF_INDEXED_8_BIT) {
            c_array += "\n";
            for(p = 0; p < 256; p ++) {
                c_array += "  0x" + str_pad(dechex(this.d_out[p * 4 + 0]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 1]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 2]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += "0x" + str_pad(dechex(this.d_out[p * 4 + 3]), 2, '0', 'STR_PAD_LEFT') + ", ";
                c_array += `\t/*Color of index ${p}*/\n`;
            }
    
            i = p * 4;
        }
        else if(this.cf == ImageMode.CF_RAW_ALPHA || this.cf == ImageMode.CF_RAW_CHROMA) {
            y_end = 1;
            x_end = count(this.d_out);
            i = 1;
        }
    
        this.d_out.push(0);
        for(var y = 0; y < y_end; y++) {
            c_array += "\n  ";
            for(var x = 0; x < x_end; x++) {
                if(i >= this.d_out.length) {
                    console.error("index out of range (" + i + ")");
                }
                if(this.cf == ImageMode.ICF_TRUE_COLOR_332) {
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";  i++;
                    if(this.alpha) {
                        c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";
                        i++;
                    }
                }
                else if(this.cf == ImageMode.ICF_TRUE_COLOR_565 || this.cf == ImageMode.ICF_TRUE_COLOR_565_SWAP) {
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";  i++;
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";  i++;
                    if(this.alpha) {
                        c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";
                        i++;
                    }
                }
                else if(this.cf == ImageMode.ICF_TRUE_COLOR_888) {
    
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";  i++;
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";  i++;
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";  i++;
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";  i++;
                }
                else if(this.cf == ImageMode.CF_ALPHA_1_BIT || this.cf == ImageMode.CF_INDEXED_1_BIT) {
                    if((x & 0x7) == 0) {
                        c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";
                        i++;
                    }
                }
                else if(this.cf == ImageMode.CF_ALPHA_2_BIT || this.cf == ImageMode.CF_INDEXED_2_BIT) {
                    if((x & 0x3) == 0) {
                        c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";
                        i++;
                    }
                }
                else if(this.cf == ImageMode.CF_ALPHA_4_BIT || this.cf == ImageMode.CF_INDEXED_4_BIT) {
                    if((x & 0x1) == 0) {
                        c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";
                        i++;
                    }
                }
                else if(this.cf == ImageMode.CF_ALPHA_8_BIT || this.cf == ImageMode.CF_INDEXED_8_BIT) {
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";
                    i++;
                }
                else if(this.cf == ImageMode.CF_RAW_ALPHA || this.cf == ImageMode.CF_RAW_CHROMA) {
                    c_array += "0x" + str_pad(dechex(this.d_out[i]), 2, '0', 'STR_PAD_LEFT') + ", ";
                    if(i != 0 && ((i % 16) == 0)) c_array += "\n  ";
                    i++;
                }
            }
        }
    
        if(this.cf == ImageMode.ICF_TRUE_COLOR_332 || this.cf == ImageMode.ICF_TRUE_COLOR_565 || this.cf == ImageMode.ICF_TRUE_COLOR_565_SWAP || this.cf == ImageMode.ICF_TRUE_COLOR_888) {
            c_array += "\n#endif";
        }
    
        return c_array;
    
    }
}



async function convert(imagePath, options) {
    const img = await loadImage(imagePath);

    console.log(`${img.width}x${img.height}`);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
    const out_name = options.outName || path.parse(imagePath).name;

    const alpha = (options.cf == ImageMode.CF_TRUE_COLOR_ALPHA || options.cf == ImageMode.CF_ALPHA_1_BIT || options.cf == ImageMode.CF_ALPHA_2_BIT || options.cf == ImageMode.CF_ALPHA_4_BIT || options.cf == ImageMode.CF_ALPHA_8_BIT);
    const c_creator = new Converter(img.width, img.height, imageData, options.dith, options.cf, alpha);

    let c_res_array;
    if(options.cf == ImageMode.CF_TRUE_COLOR || options.cf == ImageMode.CF_TRUE_COLOR_ALPHA) {
        const c_332 = await new Converter(img.width, img.height, imageData, options.dith, ImageMode.ICF_TRUE_COLOR_332, alpha).convert();
        const c_565 = await new Converter(img.width, img.height, imageData, options.dith, ImageMode.ICF_TRUE_COLOR_565, alpha).convert();
        const c_565_swap = await new Converter(img.width, img.height, imageData, options.dith, ImageMode.ICF_TRUE_COLOR_565_SWAP, alpha).convert();
        const c_888 = await new Converter(img.width, img.height, imageData, options.dith, ImageMode.ICF_TRUE_COLOR_888, alpha).convert();
        c_res_array = c_332 + c_565 + c_565_swap + c_888;
    } else
        c_res_array = await c_creator.convert();
    
    return c_creator.get_c_header(out_name) + c_res_array + c_creator.get_c_footer(options.cf, out_name);
}

export default convert;