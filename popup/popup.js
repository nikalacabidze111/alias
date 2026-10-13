"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/base64-js/index.js
  var require_base64_js = __commonJS({
    "node_modules/base64-js/index.js"(exports) {
      "use strict";
      init_build_inject();
      exports.byteLength = byteLength;
      exports.toByteArray = toByteArray;
      exports.fromByteArray = fromByteArray;
      var lookup = [];
      var revLookup = [];
      var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
      var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (i = 0, len = code.length; i < len; ++i) {
        lookup[i] = code[i];
        revLookup[code.charCodeAt(i)] = i;
      }
      var i;
      var len;
      revLookup["-".charCodeAt(0)] = 62;
      revLookup["_".charCodeAt(0)] = 63;
      function getLens(b64) {
        var len2 = b64.length;
        if (len2 % 4 > 0) {
          throw new Error("Invalid string. Length must be a multiple of 4");
        }
        var validLen = b64.indexOf("=");
        if (validLen === -1) validLen = len2;
        var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
        return [validLen, placeHoldersLen];
      }
      function byteLength(b64) {
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function _byteLength(b64, validLen, placeHoldersLen) {
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function toByteArray(b64) {
        var tmp;
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
        var curByte = 0;
        var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
        var i2;
        for (i2 = 0; i2 < len2; i2 += 4) {
          tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
          arr[curByte++] = tmp >> 16 & 255;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 2) {
          tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 1) {
          tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        return arr;
      }
      function tripletToBase64(num) {
        return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
      }
      function encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i2 = start; i2 < end; i2 += 3) {
          tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
          output.push(tripletToBase64(tmp));
        }
        return output.join("");
      }
      function fromByteArray(uint8) {
        var tmp;
        var len2 = uint8.length;
        var extraBytes = len2 % 3;
        var parts = [];
        var maxChunkLength = 16383;
        for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
          parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
        }
        if (extraBytes === 1) {
          tmp = uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
          );
        } else if (extraBytes === 2) {
          tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
          );
        }
        return parts.join("");
      }
    }
  });

  // node_modules/ieee754/index.js
  var require_ieee754 = __commonJS({
    "node_modules/ieee754/index.js"(exports) {
      init_build_inject();
      exports.read = function(buffer, offset, isLE, mLen, nBytes) {
        var e, m;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var nBits = -7;
        var i = isLE ? nBytes - 1 : 0;
        var d = isLE ? -1 : 1;
        var s = buffer[offset + i];
        i += d;
        e = s & (1 << -nBits) - 1;
        s >>= -nBits;
        nBits += eLen;
        for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        m = e & (1 << -nBits) - 1;
        e >>= -nBits;
        nBits += mLen;
        for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        if (e === 0) {
          e = 1 - eBias;
        } else if (e === eMax) {
          return m ? NaN : (s ? -1 : 1) * Infinity;
        } else {
          m = m + Math.pow(2, mLen);
          e = e - eBias;
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
      };
      exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
        var e, m, c;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
        var i = isLE ? 0 : nBytes - 1;
        var d = isLE ? 1 : -1;
        var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
        value = Math.abs(value);
        if (isNaN(value) || value === Infinity) {
          m = isNaN(value) ? 1 : 0;
          e = eMax;
        } else {
          e = Math.floor(Math.log(value) / Math.LN2);
          if (value * (c = Math.pow(2, -e)) < 1) {
            e--;
            c *= 2;
          }
          if (e + eBias >= 1) {
            value += rt / c;
          } else {
            value += rt * Math.pow(2, 1 - eBias);
          }
          if (value * c >= 2) {
            e++;
            c /= 2;
          }
          if (e + eBias >= eMax) {
            m = 0;
            e = eMax;
          } else if (e + eBias >= 1) {
            m = (value * c - 1) * Math.pow(2, mLen);
            e = e + eBias;
          } else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
            e = 0;
          }
        }
        for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
        }
        e = e << mLen | m;
        eLen += mLen;
        for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
        }
        buffer[offset + i - d] |= s * 128;
      };
    }
  });

  // node_modules/buffer/index.js
  var require_buffer = __commonJS({
    "node_modules/buffer/index.js"(exports) {
      "use strict";
      init_build_inject();
      var base64 = require_base64_js();
      var ieee754 = require_ieee754();
      var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
      exports.Buffer = Buffer2;
      exports.SlowBuffer = SlowBuffer;
      exports.INSPECT_MAX_BYTES = 50;
      var K_MAX_LENGTH = 2147483647;
      exports.kMaxLength = K_MAX_LENGTH;
      Buffer2.TYPED_ARRAY_SUPPORT = typedArraySupport();
      if (!Buffer2.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
        console.error(
          "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
        );
      }
      function typedArraySupport() {
        try {
          const arr = new Uint8Array(1);
          const proto = { foo: function() {
            return 42;
          } };
          Object.setPrototypeOf(proto, Uint8Array.prototype);
          Object.setPrototypeOf(arr, proto);
          return arr.foo() === 42;
        } catch (e) {
          return false;
        }
      }
      Object.defineProperty(Buffer2.prototype, "parent", {
        enumerable: true,
        get: function() {
          if (!Buffer2.isBuffer(this)) return void 0;
          return this.buffer;
        }
      });
      Object.defineProperty(Buffer2.prototype, "offset", {
        enumerable: true,
        get: function() {
          if (!Buffer2.isBuffer(this)) return void 0;
          return this.byteOffset;
        }
      });
      function createBuffer(length) {
        if (length > K_MAX_LENGTH) {
          throw new RangeError('The value "' + length + '" is invalid for option "size"');
        }
        const buf = new Uint8Array(length);
        Object.setPrototypeOf(buf, Buffer2.prototype);
        return buf;
      }
      function Buffer2(arg, encodingOrOffset, length) {
        if (typeof arg === "number") {
          if (typeof encodingOrOffset === "string") {
            throw new TypeError(
              'The "string" argument must be of type string. Received type number'
            );
          }
          return allocUnsafe(arg);
        }
        return from(arg, encodingOrOffset, length);
      }
      Buffer2.poolSize = 8192;
      function from(value, encodingOrOffset, length) {
        if (typeof value === "string") {
          return fromString(value, encodingOrOffset);
        }
        if (ArrayBuffer.isView(value)) {
          return fromArrayView(value);
        }
        if (value == null) {
          throw new TypeError(
            "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
          );
        }
        if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof value === "number") {
          throw new TypeError(
            'The "value" argument must not be of type number. Received type number'
          );
        }
        const valueOf = value.valueOf && value.valueOf();
        if (valueOf != null && valueOf !== value) {
          return Buffer2.from(valueOf, encodingOrOffset, length);
        }
        const b = fromObject(value);
        if (b) return b;
        if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
          return Buffer2.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
        }
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      Buffer2.from = function(value, encodingOrOffset, length) {
        return from(value, encodingOrOffset, length);
      };
      Object.setPrototypeOf(Buffer2.prototype, Uint8Array.prototype);
      Object.setPrototypeOf(Buffer2, Uint8Array);
      function assertSize(size) {
        if (typeof size !== "number") {
          throw new TypeError('"size" argument must be of type number');
        } else if (size < 0) {
          throw new RangeError('The value "' + size + '" is invalid for option "size"');
        }
      }
      function alloc(size, fill, encoding) {
        assertSize(size);
        if (size <= 0) {
          return createBuffer(size);
        }
        if (fill !== void 0) {
          return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
        }
        return createBuffer(size);
      }
      Buffer2.alloc = function(size, fill, encoding) {
        return alloc(size, fill, encoding);
      };
      function allocUnsafe(size) {
        assertSize(size);
        return createBuffer(size < 0 ? 0 : checked(size) | 0);
      }
      Buffer2.allocUnsafe = function(size) {
        return allocUnsafe(size);
      };
      Buffer2.allocUnsafeSlow = function(size) {
        return allocUnsafe(size);
      };
      function fromString(string, encoding) {
        if (typeof encoding !== "string" || encoding === "") {
          encoding = "utf8";
        }
        if (!Buffer2.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        const length = byteLength(string, encoding) | 0;
        let buf = createBuffer(length);
        const actual = buf.write(string, encoding);
        if (actual !== length) {
          buf = buf.slice(0, actual);
        }
        return buf;
      }
      function fromArrayLike(array) {
        const length = array.length < 0 ? 0 : checked(array.length) | 0;
        const buf = createBuffer(length);
        for (let i = 0; i < length; i += 1) {
          buf[i] = array[i] & 255;
        }
        return buf;
      }
      function fromArrayView(arrayView) {
        if (isInstance(arrayView, Uint8Array)) {
          const copy = new Uint8Array(arrayView);
          return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
        }
        return fromArrayLike(arrayView);
      }
      function fromArrayBuffer(array, byteOffset, length) {
        if (byteOffset < 0 || array.byteLength < byteOffset) {
          throw new RangeError('"offset" is outside of buffer bounds');
        }
        if (array.byteLength < byteOffset + (length || 0)) {
          throw new RangeError('"length" is outside of buffer bounds');
        }
        let buf;
        if (byteOffset === void 0 && length === void 0) {
          buf = new Uint8Array(array);
        } else if (length === void 0) {
          buf = new Uint8Array(array, byteOffset);
        } else {
          buf = new Uint8Array(array, byteOffset, length);
        }
        Object.setPrototypeOf(buf, Buffer2.prototype);
        return buf;
      }
      function fromObject(obj) {
        if (Buffer2.isBuffer(obj)) {
          const len = checked(obj.length) | 0;
          const buf = createBuffer(len);
          if (buf.length === 0) {
            return buf;
          }
          obj.copy(buf, 0, 0, len);
          return buf;
        }
        if (obj.length !== void 0) {
          if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
            return createBuffer(0);
          }
          return fromArrayLike(obj);
        }
        if (obj.type === "Buffer" && Array.isArray(obj.data)) {
          return fromArrayLike(obj.data);
        }
      }
      function checked(length) {
        if (length >= K_MAX_LENGTH) {
          throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
        }
        return length | 0;
      }
      function SlowBuffer(length) {
        if (+length != length) {
          length = 0;
        }
        return Buffer2.alloc(+length);
      }
      Buffer2.isBuffer = function isBuffer(b) {
        return b != null && b._isBuffer === true && b !== Buffer2.prototype;
      };
      Buffer2.compare = function compare(a, b) {
        if (isInstance(a, Uint8Array)) a = Buffer2.from(a, a.offset, a.byteLength);
        if (isInstance(b, Uint8Array)) b = Buffer2.from(b, b.offset, b.byteLength);
        if (!Buffer2.isBuffer(a) || !Buffer2.isBuffer(b)) {
          throw new TypeError(
            'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
          );
        }
        if (a === b) return 0;
        let x = a.length;
        let y = b.length;
        for (let i = 0, len = Math.min(x, y); i < len; ++i) {
          if (a[i] !== b[i]) {
            x = a[i];
            y = b[i];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      Buffer2.isEncoding = function isEncoding(encoding) {
        switch (String(encoding).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      };
      Buffer2.concat = function concat(list, length) {
        if (!Array.isArray(list)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        }
        if (list.length === 0) {
          return Buffer2.alloc(0);
        }
        let i;
        if (length === void 0) {
          length = 0;
          for (i = 0; i < list.length; ++i) {
            length += list[i].length;
          }
        }
        const buffer = Buffer2.allocUnsafe(length);
        let pos = 0;
        for (i = 0; i < list.length; ++i) {
          let buf = list[i];
          if (isInstance(buf, Uint8Array)) {
            if (pos + buf.length > buffer.length) {
              if (!Buffer2.isBuffer(buf)) buf = Buffer2.from(buf);
              buf.copy(buffer, pos);
            } else {
              Uint8Array.prototype.set.call(
                buffer,
                buf,
                pos
              );
            }
          } else if (!Buffer2.isBuffer(buf)) {
            throw new TypeError('"list" argument must be an Array of Buffers');
          } else {
            buf.copy(buffer, pos);
          }
          pos += buf.length;
        }
        return buffer;
      };
      function byteLength(string, encoding) {
        if (Buffer2.isBuffer(string)) {
          return string.length;
        }
        if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
          return string.byteLength;
        }
        if (typeof string !== "string") {
          throw new TypeError(
            'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
          );
        }
        const len = string.length;
        const mustMatch = arguments.length > 2 && arguments[2] === true;
        if (!mustMatch && len === 0) return 0;
        let loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "ascii":
            case "latin1":
            case "binary":
              return len;
            case "utf8":
            case "utf-8":
              return utf8ToBytes(string).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return len * 2;
            case "hex":
              return len >>> 1;
            case "base64":
              return base64ToBytes(string).length;
            default:
              if (loweredCase) {
                return mustMatch ? -1 : utf8ToBytes(string).length;
              }
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer2.byteLength = byteLength;
      function slowToString(encoding, start, end) {
        let loweredCase = false;
        if (start === void 0 || start < 0) {
          start = 0;
        }
        if (start > this.length) {
          return "";
        }
        if (end === void 0 || end > this.length) {
          end = this.length;
        }
        if (end <= 0) {
          return "";
        }
        end >>>= 0;
        start >>>= 0;
        if (end <= start) {
          return "";
        }
        if (!encoding) encoding = "utf8";
        while (true) {
          switch (encoding) {
            case "hex":
              return hexSlice(this, start, end);
            case "utf8":
            case "utf-8":
              return utf8Slice(this, start, end);
            case "ascii":
              return asciiSlice(this, start, end);
            case "latin1":
            case "binary":
              return latin1Slice(this, start, end);
            case "base64":
              return base64Slice(this, start, end);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return utf16leSlice(this, start, end);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = (encoding + "").toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer2.prototype._isBuffer = true;
      function swap(b, n, m) {
        const i = b[n];
        b[n] = b[m];
        b[m] = i;
      }
      Buffer2.prototype.swap16 = function swap16() {
        const len = this.length;
        if (len % 2 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 16-bits");
        }
        for (let i = 0; i < len; i += 2) {
          swap(this, i, i + 1);
        }
        return this;
      };
      Buffer2.prototype.swap32 = function swap32() {
        const len = this.length;
        if (len % 4 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 32-bits");
        }
        for (let i = 0; i < len; i += 4) {
          swap(this, i, i + 3);
          swap(this, i + 1, i + 2);
        }
        return this;
      };
      Buffer2.prototype.swap64 = function swap64() {
        const len = this.length;
        if (len % 8 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 64-bits");
        }
        for (let i = 0; i < len; i += 8) {
          swap(this, i, i + 7);
          swap(this, i + 1, i + 6);
          swap(this, i + 2, i + 5);
          swap(this, i + 3, i + 4);
        }
        return this;
      };
      Buffer2.prototype.toString = function toString() {
        const length = this.length;
        if (length === 0) return "";
        if (arguments.length === 0) return utf8Slice(this, 0, length);
        return slowToString.apply(this, arguments);
      };
      Buffer2.prototype.toLocaleString = Buffer2.prototype.toString;
      Buffer2.prototype.equals = function equals(b) {
        if (!Buffer2.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
        if (this === b) return true;
        return Buffer2.compare(this, b) === 0;
      };
      Buffer2.prototype.inspect = function inspect() {
        let str = "";
        const max = exports.INSPECT_MAX_BYTES;
        str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
        if (this.length > max) str += " ... ";
        return "<Buffer " + str + ">";
      };
      if (customInspectSymbol) {
        Buffer2.prototype[customInspectSymbol] = Buffer2.prototype.inspect;
      }
      Buffer2.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
        if (isInstance(target, Uint8Array)) {
          target = Buffer2.from(target, target.offset, target.byteLength);
        }
        if (!Buffer2.isBuffer(target)) {
          throw new TypeError(
            'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
          );
        }
        if (start === void 0) {
          start = 0;
        }
        if (end === void 0) {
          end = target ? target.length : 0;
        }
        if (thisStart === void 0) {
          thisStart = 0;
        }
        if (thisEnd === void 0) {
          thisEnd = this.length;
        }
        if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
          throw new RangeError("out of range index");
        }
        if (thisStart >= thisEnd && start >= end) {
          return 0;
        }
        if (thisStart >= thisEnd) {
          return -1;
        }
        if (start >= end) {
          return 1;
        }
        start >>>= 0;
        end >>>= 0;
        thisStart >>>= 0;
        thisEnd >>>= 0;
        if (this === target) return 0;
        let x = thisEnd - thisStart;
        let y = end - start;
        const len = Math.min(x, y);
        const thisCopy = this.slice(thisStart, thisEnd);
        const targetCopy = target.slice(start, end);
        for (let i = 0; i < len; ++i) {
          if (thisCopy[i] !== targetCopy[i]) {
            x = thisCopy[i];
            y = targetCopy[i];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      function bidirectionalIndexOf(buffer, val2, byteOffset, encoding, dir) {
        if (buffer.length === 0) return -1;
        if (typeof byteOffset === "string") {
          encoding = byteOffset;
          byteOffset = 0;
        } else if (byteOffset > 2147483647) {
          byteOffset = 2147483647;
        } else if (byteOffset < -2147483648) {
          byteOffset = -2147483648;
        }
        byteOffset = +byteOffset;
        if (numberIsNaN(byteOffset)) {
          byteOffset = dir ? 0 : buffer.length - 1;
        }
        if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
        if (byteOffset >= buffer.length) {
          if (dir) return -1;
          else byteOffset = buffer.length - 1;
        } else if (byteOffset < 0) {
          if (dir) byteOffset = 0;
          else return -1;
        }
        if (typeof val2 === "string") {
          val2 = Buffer2.from(val2, encoding);
        }
        if (Buffer2.isBuffer(val2)) {
          if (val2.length === 0) {
            return -1;
          }
          return arrayIndexOf(buffer, val2, byteOffset, encoding, dir);
        } else if (typeof val2 === "number") {
          val2 = val2 & 255;
          if (typeof Uint8Array.prototype.indexOf === "function") {
            if (dir) {
              return Uint8Array.prototype.indexOf.call(buffer, val2, byteOffset);
            } else {
              return Uint8Array.prototype.lastIndexOf.call(buffer, val2, byteOffset);
            }
          }
          return arrayIndexOf(buffer, [val2], byteOffset, encoding, dir);
        }
        throw new TypeError("val must be string, number or Buffer");
      }
      function arrayIndexOf(arr, val2, byteOffset, encoding, dir) {
        let indexSize = 1;
        let arrLength = arr.length;
        let valLength = val2.length;
        if (encoding !== void 0) {
          encoding = String(encoding).toLowerCase();
          if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
            if (arr.length < 2 || val2.length < 2) {
              return -1;
            }
            indexSize = 2;
            arrLength /= 2;
            valLength /= 2;
            byteOffset /= 2;
          }
        }
        function read(buf, i2) {
          if (indexSize === 1) {
            return buf[i2];
          } else {
            return buf.readUInt16BE(i2 * indexSize);
          }
        }
        let i;
        if (dir) {
          let foundIndex = -1;
          for (i = byteOffset; i < arrLength; i++) {
            if (read(arr, i) === read(val2, foundIndex === -1 ? 0 : i - foundIndex)) {
              if (foundIndex === -1) foundIndex = i;
              if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
            } else {
              if (foundIndex !== -1) i -= i - foundIndex;
              foundIndex = -1;
            }
          }
        } else {
          if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
          for (i = byteOffset; i >= 0; i--) {
            let found = true;
            for (let j = 0; j < valLength; j++) {
              if (read(arr, i + j) !== read(val2, j)) {
                found = false;
                break;
              }
            }
            if (found) return i;
          }
        }
        return -1;
      }
      Buffer2.prototype.includes = function includes(val2, byteOffset, encoding) {
        return this.indexOf(val2, byteOffset, encoding) !== -1;
      };
      Buffer2.prototype.indexOf = function indexOf(val2, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val2, byteOffset, encoding, true);
      };
      Buffer2.prototype.lastIndexOf = function lastIndexOf(val2, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val2, byteOffset, encoding, false);
      };
      function hexWrite(buf, string, offset, length) {
        offset = Number(offset) || 0;
        const remaining = buf.length - offset;
        if (!length) {
          length = remaining;
        } else {
          length = Number(length);
          if (length > remaining) {
            length = remaining;
          }
        }
        const strLen = string.length;
        if (length > strLen / 2) {
          length = strLen / 2;
        }
        let i;
        for (i = 0; i < length; ++i) {
          const parsed = parseInt(string.substr(i * 2, 2), 16);
          if (numberIsNaN(parsed)) return i;
          buf[offset + i] = parsed;
        }
        return i;
      }
      function utf8Write(buf, string, offset, length) {
        return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
      }
      function asciiWrite(buf, string, offset, length) {
        return blitBuffer(asciiToBytes(string), buf, offset, length);
      }
      function base64Write(buf, string, offset, length) {
        return blitBuffer(base64ToBytes(string), buf, offset, length);
      }
      function ucs2Write(buf, string, offset, length) {
        return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
      }
      Buffer2.prototype.write = function write(string, offset, length, encoding) {
        if (offset === void 0) {
          encoding = "utf8";
          length = this.length;
          offset = 0;
        } else if (length === void 0 && typeof offset === "string") {
          encoding = offset;
          length = this.length;
          offset = 0;
        } else if (isFinite(offset)) {
          offset = offset >>> 0;
          if (isFinite(length)) {
            length = length >>> 0;
            if (encoding === void 0) encoding = "utf8";
          } else {
            encoding = length;
            length = void 0;
          }
        } else {
          throw new Error(
            "Buffer.write(string, encoding, offset[, length]) is no longer supported"
          );
        }
        const remaining = this.length - offset;
        if (length === void 0 || length > remaining) length = remaining;
        if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
          throw new RangeError("Attempt to write outside buffer bounds");
        }
        if (!encoding) encoding = "utf8";
        let loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "hex":
              return hexWrite(this, string, offset, length);
            case "utf8":
            case "utf-8":
              return utf8Write(this, string, offset, length);
            case "ascii":
            case "latin1":
            case "binary":
              return asciiWrite(this, string, offset, length);
            case "base64":
              return base64Write(this, string, offset, length);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return ucs2Write(this, string, offset, length);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      };
      Buffer2.prototype.toJSON = function toJSON() {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        };
      };
      function base64Slice(buf, start, end) {
        if (start === 0 && end === buf.length) {
          return base64.fromByteArray(buf);
        } else {
          return base64.fromByteArray(buf.slice(start, end));
        }
      }
      function utf8Slice(buf, start, end) {
        end = Math.min(buf.length, end);
        const res = [];
        let i = start;
        while (i < end) {
          const firstByte = buf[i];
          let codePoint = null;
          let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
          if (i + bytesPerSequence <= end) {
            let secondByte, thirdByte, fourthByte, tempCodePoint;
            switch (bytesPerSequence) {
              case 1:
                if (firstByte < 128) {
                  codePoint = firstByte;
                }
                break;
              case 2:
                secondByte = buf[i + 1];
                if ((secondByte & 192) === 128) {
                  tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                  if (tempCodePoint > 127) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 3:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                  if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 4:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                fourthByte = buf[i + 3];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                  if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                    codePoint = tempCodePoint;
                  }
                }
            }
          }
          if (codePoint === null) {
            codePoint = 65533;
            bytesPerSequence = 1;
          } else if (codePoint > 65535) {
            codePoint -= 65536;
            res.push(codePoint >>> 10 & 1023 | 55296);
            codePoint = 56320 | codePoint & 1023;
          }
          res.push(codePoint);
          i += bytesPerSequence;
        }
        return decodeCodePointsArray(res);
      }
      var MAX_ARGUMENTS_LENGTH = 4096;
      function decodeCodePointsArray(codePoints) {
        const len = codePoints.length;
        if (len <= MAX_ARGUMENTS_LENGTH) {
          return String.fromCharCode.apply(String, codePoints);
        }
        let res = "";
        let i = 0;
        while (i < len) {
          res += String.fromCharCode.apply(
            String,
            codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
          );
        }
        return res;
      }
      function asciiSlice(buf, start, end) {
        let ret = "";
        end = Math.min(buf.length, end);
        for (let i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i] & 127);
        }
        return ret;
      }
      function latin1Slice(buf, start, end) {
        let ret = "";
        end = Math.min(buf.length, end);
        for (let i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i]);
        }
        return ret;
      }
      function hexSlice(buf, start, end) {
        const len = buf.length;
        if (!start || start < 0) start = 0;
        if (!end || end < 0 || end > len) end = len;
        let out = "";
        for (let i = start; i < end; ++i) {
          out += hexSliceLookupTable[buf[i]];
        }
        return out;
      }
      function utf16leSlice(buf, start, end) {
        const bytes = buf.slice(start, end);
        let res = "";
        for (let i = 0; i < bytes.length - 1; i += 2) {
          res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
        }
        return res;
      }
      Buffer2.prototype.slice = function slice(start, end) {
        const len = this.length;
        start = ~~start;
        end = end === void 0 ? len : ~~end;
        if (start < 0) {
          start += len;
          if (start < 0) start = 0;
        } else if (start > len) {
          start = len;
        }
        if (end < 0) {
          end += len;
          if (end < 0) end = 0;
        } else if (end > len) {
          end = len;
        }
        if (end < start) end = start;
        const newBuf = this.subarray(start, end);
        Object.setPrototypeOf(newBuf, Buffer2.prototype);
        return newBuf;
      };
      function checkOffset(offset, ext, length) {
        if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
        if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
      }
      Buffer2.prototype.readUintLE = Buffer2.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength2, this.length);
        let val2 = this[offset];
        let mul = 1;
        let i = 0;
        while (++i < byteLength2 && (mul *= 256)) {
          val2 += this[offset + i] * mul;
        }
        return val2;
      };
      Buffer2.prototype.readUintBE = Buffer2.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          checkOffset(offset, byteLength2, this.length);
        }
        let val2 = this[offset + --byteLength2];
        let mul = 1;
        while (byteLength2 > 0 && (mul *= 256)) {
          val2 += this[offset + --byteLength2] * mul;
        }
        return val2;
      };
      Buffer2.prototype.readUint8 = Buffer2.prototype.readUInt8 = function readUInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 1, this.length);
        return this[offset];
      };
      Buffer2.prototype.readUint16LE = Buffer2.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] | this[offset + 1] << 8;
      };
      Buffer2.prototype.readUint16BE = Buffer2.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] << 8 | this[offset + 1];
      };
      Buffer2.prototype.readUint32LE = Buffer2.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
      };
      Buffer2.prototype.readUint32BE = Buffer2.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
      };
      Buffer2.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
        const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
        return BigInt(lo) + (BigInt(hi) << BigInt(32));
      });
      Buffer2.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
        const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
        return (BigInt(hi) << BigInt(32)) + BigInt(lo);
      });
      Buffer2.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength2, this.length);
        let val2 = this[offset];
        let mul = 1;
        let i = 0;
        while (++i < byteLength2 && (mul *= 256)) {
          val2 += this[offset + i] * mul;
        }
        mul *= 128;
        if (val2 >= mul) val2 -= Math.pow(2, 8 * byteLength2);
        return val2;
      };
      Buffer2.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength2, this.length);
        let i = byteLength2;
        let mul = 1;
        let val2 = this[offset + --i];
        while (i > 0 && (mul *= 256)) {
          val2 += this[offset + --i] * mul;
        }
        mul *= 128;
        if (val2 >= mul) val2 -= Math.pow(2, 8 * byteLength2);
        return val2;
      };
      Buffer2.prototype.readInt8 = function readInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 1, this.length);
        if (!(this[offset] & 128)) return this[offset];
        return (255 - this[offset] + 1) * -1;
      };
      Buffer2.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        const val2 = this[offset] | this[offset + 1] << 8;
        return val2 & 32768 ? val2 | 4294901760 : val2;
      };
      Buffer2.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        const val2 = this[offset + 1] | this[offset] << 8;
        return val2 & 32768 ? val2 | 4294901760 : val2;
      };
      Buffer2.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
      };
      Buffer2.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
      };
      Buffer2.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const val2 = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
        return (BigInt(val2) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
      });
      Buffer2.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const val2 = (first << 24) + // Overflow
        this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
        return (BigInt(val2) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
      });
      Buffer2.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, true, 23, 4);
      };
      Buffer2.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, false, 23, 4);
      };
      Buffer2.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, true, 52, 8);
      };
      Buffer2.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, false, 52, 8);
      };
      function checkInt(buf, value, offset, ext, max, min) {
        if (!Buffer2.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
        if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
      }
      Buffer2.prototype.writeUintLE = Buffer2.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset, byteLength2, maxBytes, 0);
        }
        let mul = 1;
        let i = 0;
        this[offset] = value & 255;
        while (++i < byteLength2 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength2;
      };
      Buffer2.prototype.writeUintBE = Buffer2.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset, byteLength2, maxBytes, 0);
        }
        let i = byteLength2 - 1;
        let mul = 1;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength2;
      };
      Buffer2.prototype.writeUint8 = Buffer2.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer2.prototype.writeUint16LE = Buffer2.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer2.prototype.writeUint16BE = Buffer2.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer2.prototype.writeUint32LE = Buffer2.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset + 3] = value >>> 24;
        this[offset + 2] = value >>> 16;
        this[offset + 1] = value >>> 8;
        this[offset] = value & 255;
        return offset + 4;
      };
      Buffer2.prototype.writeUint32BE = Buffer2.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      function wrtBigUInt64LE(buf, value, offset, min, max) {
        checkIntBI(value, min, max, buf, offset, 7);
        let lo = Number(value & BigInt(4294967295));
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        let hi = Number(value >> BigInt(32) & BigInt(4294967295));
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        return offset;
      }
      function wrtBigUInt64BE(buf, value, offset, min, max) {
        checkIntBI(value, min, max, buf, offset, 7);
        let lo = Number(value & BigInt(4294967295));
        buf[offset + 7] = lo;
        lo = lo >> 8;
        buf[offset + 6] = lo;
        lo = lo >> 8;
        buf[offset + 5] = lo;
        lo = lo >> 8;
        buf[offset + 4] = lo;
        let hi = Number(value >> BigInt(32) & BigInt(4294967295));
        buf[offset + 3] = hi;
        hi = hi >> 8;
        buf[offset + 2] = hi;
        hi = hi >> 8;
        buf[offset + 1] = hi;
        hi = hi >> 8;
        buf[offset] = hi;
        return offset + 8;
      }
      Buffer2.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset = 0) {
        return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
      });
      Buffer2.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset = 0) {
        return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
      });
      Buffer2.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          const limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset, byteLength2, limit - 1, -limit);
        }
        let i = 0;
        let mul = 1;
        let sub = 0;
        this[offset] = value & 255;
        while (++i < byteLength2 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength2;
      };
      Buffer2.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          const limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset, byteLength2, limit - 1, -limit);
        }
        let i = byteLength2 - 1;
        let mul = 1;
        let sub = 0;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength2;
      };
      Buffer2.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
        if (value < 0) value = 255 + value + 1;
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer2.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer2.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer2.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        this[offset + 2] = value >>> 16;
        this[offset + 3] = value >>> 24;
        return offset + 4;
      };
      Buffer2.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        if (value < 0) value = 4294967295 + value + 1;
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      Buffer2.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset = 0) {
        return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
      });
      Buffer2.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset = 0) {
        return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
      });
      function checkIEEE754(buf, value, offset, ext, max, min) {
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
        if (offset < 0) throw new RangeError("Index out of range");
      }
      function writeFloat(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
        }
        ieee754.write(buf, value, offset, littleEndian, 23, 4);
        return offset + 4;
      }
      Buffer2.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
        return writeFloat(this, value, offset, true, noAssert);
      };
      Buffer2.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
        return writeFloat(this, value, offset, false, noAssert);
      };
      function writeDouble(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
        }
        ieee754.write(buf, value, offset, littleEndian, 52, 8);
        return offset + 8;
      }
      Buffer2.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
        return writeDouble(this, value, offset, true, noAssert);
      };
      Buffer2.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
        return writeDouble(this, value, offset, false, noAssert);
      };
      Buffer2.prototype.copy = function copy(target, targetStart, start, end) {
        if (!Buffer2.isBuffer(target)) throw new TypeError("argument should be a Buffer");
        if (!start) start = 0;
        if (!end && end !== 0) end = this.length;
        if (targetStart >= target.length) targetStart = target.length;
        if (!targetStart) targetStart = 0;
        if (end > 0 && end < start) end = start;
        if (end === start) return 0;
        if (target.length === 0 || this.length === 0) return 0;
        if (targetStart < 0) {
          throw new RangeError("targetStart out of bounds");
        }
        if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
        if (end < 0) throw new RangeError("sourceEnd out of bounds");
        if (end > this.length) end = this.length;
        if (target.length - targetStart < end - start) {
          end = target.length - targetStart + start;
        }
        const len = end - start;
        if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
          this.copyWithin(targetStart, start, end);
        } else {
          Uint8Array.prototype.set.call(
            target,
            this.subarray(start, end),
            targetStart
          );
        }
        return len;
      };
      Buffer2.prototype.fill = function fill(val2, start, end, encoding) {
        if (typeof val2 === "string") {
          if (typeof start === "string") {
            encoding = start;
            start = 0;
            end = this.length;
          } else if (typeof end === "string") {
            encoding = end;
            end = this.length;
          }
          if (encoding !== void 0 && typeof encoding !== "string") {
            throw new TypeError("encoding must be a string");
          }
          if (typeof encoding === "string" && !Buffer2.isEncoding(encoding)) {
            throw new TypeError("Unknown encoding: " + encoding);
          }
          if (val2.length === 1) {
            const code = val2.charCodeAt(0);
            if (encoding === "utf8" && code < 128 || encoding === "latin1") {
              val2 = code;
            }
          }
        } else if (typeof val2 === "number") {
          val2 = val2 & 255;
        } else if (typeof val2 === "boolean") {
          val2 = Number(val2);
        }
        if (start < 0 || this.length < start || this.length < end) {
          throw new RangeError("Out of range index");
        }
        if (end <= start) {
          return this;
        }
        start = start >>> 0;
        end = end === void 0 ? this.length : end >>> 0;
        if (!val2) val2 = 0;
        let i;
        if (typeof val2 === "number") {
          for (i = start; i < end; ++i) {
            this[i] = val2;
          }
        } else {
          const bytes = Buffer2.isBuffer(val2) ? val2 : Buffer2.from(val2, encoding);
          const len = bytes.length;
          if (len === 0) {
            throw new TypeError('The value "' + val2 + '" is invalid for argument "value"');
          }
          for (i = 0; i < end - start; ++i) {
            this[i + start] = bytes[i % len];
          }
        }
        return this;
      };
      var errors = {};
      function E(sym, getMessage, Base) {
        errors[sym] = class NodeError extends Base {
          constructor() {
            super();
            Object.defineProperty(this, "message", {
              value: getMessage.apply(this, arguments),
              writable: true,
              configurable: true
            });
            this.name = `${this.name} [${sym}]`;
            this.stack;
            delete this.name;
          }
          get code() {
            return sym;
          }
          set code(value) {
            Object.defineProperty(this, "code", {
              configurable: true,
              enumerable: true,
              value,
              writable: true
            });
          }
          toString() {
            return `${this.name} [${sym}]: ${this.message}`;
          }
        };
      }
      E(
        "ERR_BUFFER_OUT_OF_BOUNDS",
        function(name) {
          if (name) {
            return `${name} is outside of buffer bounds`;
          }
          return "Attempt to access memory outside buffer bounds";
        },
        RangeError
      );
      E(
        "ERR_INVALID_ARG_TYPE",
        function(name, actual) {
          return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
        },
        TypeError
      );
      E(
        "ERR_OUT_OF_RANGE",
        function(str, range, input) {
          let msg = `The value of "${str}" is out of range.`;
          let received = input;
          if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
            received = addNumericalSeparator(String(input));
          } else if (typeof input === "bigint") {
            received = String(input);
            if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
              received = addNumericalSeparator(received);
            }
            received += "n";
          }
          msg += ` It must be ${range}. Received ${received}`;
          return msg;
        },
        RangeError
      );
      function addNumericalSeparator(val2) {
        let res = "";
        let i = val2.length;
        const start = val2[0] === "-" ? 1 : 0;
        for (; i >= start + 4; i -= 3) {
          res = `_${val2.slice(i - 3, i)}${res}`;
        }
        return `${val2.slice(0, i)}${res}`;
      }
      function checkBounds(buf, offset, byteLength2) {
        validateNumber(offset, "offset");
        if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
          boundsError(offset, buf.length - (byteLength2 + 1));
        }
      }
      function checkIntBI(value, min, max, buf, offset, byteLength2) {
        if (value > max || value < min) {
          const n = typeof min === "bigint" ? "n" : "";
          let range;
          if (byteLength2 > 3) {
            if (min === 0 || min === BigInt(0)) {
              range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
            } else {
              range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
            }
          } else {
            range = `>= ${min}${n} and <= ${max}${n}`;
          }
          throw new errors.ERR_OUT_OF_RANGE("value", range, value);
        }
        checkBounds(buf, offset, byteLength2);
      }
      function validateNumber(value, name) {
        if (typeof value !== "number") {
          throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
        }
      }
      function boundsError(value, length, type) {
        if (Math.floor(value) !== value) {
          validateNumber(value, type);
          throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
        }
        if (length < 0) {
          throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
        }
        throw new errors.ERR_OUT_OF_RANGE(
          type || "offset",
          `>= ${type ? 1 : 0} and <= ${length}`,
          value
        );
      }
      var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
      function base64clean(str) {
        str = str.split("=")[0];
        str = str.trim().replace(INVALID_BASE64_RE, "");
        if (str.length < 2) return "";
        while (str.length % 4 !== 0) {
          str = str + "=";
        }
        return str;
      }
      function utf8ToBytes(string, units) {
        units = units || Infinity;
        let codePoint;
        const length = string.length;
        let leadSurrogate = null;
        const bytes = [];
        for (let i = 0; i < length; ++i) {
          codePoint = string.charCodeAt(i);
          if (codePoint > 55295 && codePoint < 57344) {
            if (!leadSurrogate) {
              if (codePoint > 56319) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              } else if (i + 1 === length) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              }
              leadSurrogate = codePoint;
              continue;
            }
            if (codePoint < 56320) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              leadSurrogate = codePoint;
              continue;
            }
            codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
          } else if (leadSurrogate) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
          }
          leadSurrogate = null;
          if (codePoint < 128) {
            if ((units -= 1) < 0) break;
            bytes.push(codePoint);
          } else if (codePoint < 2048) {
            if ((units -= 2) < 0) break;
            bytes.push(
              codePoint >> 6 | 192,
              codePoint & 63 | 128
            );
          } else if (codePoint < 65536) {
            if ((units -= 3) < 0) break;
            bytes.push(
              codePoint >> 12 | 224,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else if (codePoint < 1114112) {
            if ((units -= 4) < 0) break;
            bytes.push(
              codePoint >> 18 | 240,
              codePoint >> 12 & 63 | 128,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else {
            throw new Error("Invalid code point");
          }
        }
        return bytes;
      }
      function asciiToBytes(str) {
        const byteArray = [];
        for (let i = 0; i < str.length; ++i) {
          byteArray.push(str.charCodeAt(i) & 255);
        }
        return byteArray;
      }
      function utf16leToBytes(str, units) {
        let c, hi, lo;
        const byteArray = [];
        for (let i = 0; i < str.length; ++i) {
          if ((units -= 2) < 0) break;
          c = str.charCodeAt(i);
          hi = c >> 8;
          lo = c % 256;
          byteArray.push(lo);
          byteArray.push(hi);
        }
        return byteArray;
      }
      function base64ToBytes(str) {
        return base64.toByteArray(base64clean(str));
      }
      function blitBuffer(src, dst, offset, length) {
        let i;
        for (i = 0; i < length; ++i) {
          if (i + offset >= dst.length || i >= src.length) break;
          dst[i + offset] = src[i];
        }
        return i;
      }
      function isInstance(obj, type) {
        return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
      }
      function numberIsNaN(obj) {
        return obj !== obj;
      }
      var hexSliceLookupTable = (function() {
        const alphabet = "0123456789abcdef";
        const table = new Array(256);
        for (let i = 0; i < 16; ++i) {
          const i16 = i * 16;
          for (let j = 0; j < 16; ++j) {
            table[i16 + j] = alphabet[i] + alphabet[j];
          }
        }
        return table;
      })();
      function defineBigIntMethod(fn) {
        return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
      }
      function BufferBigIntNotDefined() {
        throw new Error("BigInt not supported");
      }
    }
  });

  // node_modules/process/browser.js
  var require_browser = __commonJS({
    "node_modules/process/browser.js"(exports, module) {
      init_build_inject();
      var process = module.exports = {};
      var cachedSetTimeout;
      var cachedClearTimeout;
      function defaultSetTimout() {
        throw new Error("setTimeout has not been defined");
      }
      function defaultClearTimeout() {
        throw new Error("clearTimeout has not been defined");
      }
      (function() {
        try {
          if (typeof setTimeout === "function") {
            cachedSetTimeout = setTimeout;
          } else {
            cachedSetTimeout = defaultSetTimout;
          }
        } catch (e) {
          cachedSetTimeout = defaultSetTimout;
        }
        try {
          if (typeof clearTimeout === "function") {
            cachedClearTimeout = clearTimeout;
          } else {
            cachedClearTimeout = defaultClearTimeout;
          }
        } catch (e) {
          cachedClearTimeout = defaultClearTimeout;
        }
      })();
      function runTimeout(fun) {
        if (cachedSetTimeout === setTimeout) {
          return setTimeout(fun, 0);
        }
        if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
          cachedSetTimeout = setTimeout;
          return setTimeout(fun, 0);
        }
        try {
          return cachedSetTimeout(fun, 0);
        } catch (e) {
          try {
            return cachedSetTimeout.call(null, fun, 0);
          } catch (e2) {
            return cachedSetTimeout.call(this, fun, 0);
          }
        }
      }
      function runClearTimeout(marker) {
        if (cachedClearTimeout === clearTimeout) {
          return clearTimeout(marker);
        }
        if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
          cachedClearTimeout = clearTimeout;
          return clearTimeout(marker);
        }
        try {
          return cachedClearTimeout(marker);
        } catch (e) {
          try {
            return cachedClearTimeout.call(null, marker);
          } catch (e2) {
            return cachedClearTimeout.call(this, marker);
          }
        }
      }
      var queue = [];
      var draining = false;
      var currentQueue;
      var queueIndex = -1;
      function cleanUpNextTick() {
        if (!draining || !currentQueue) {
          return;
        }
        draining = false;
        if (currentQueue.length) {
          queue = currentQueue.concat(queue);
        } else {
          queueIndex = -1;
        }
        if (queue.length) {
          drainQueue();
        }
      }
      function drainQueue() {
        if (draining) {
          return;
        }
        var timeout = runTimeout(cleanUpNextTick);
        draining = true;
        var len = queue.length;
        while (len) {
          currentQueue = queue;
          queue = [];
          while (++queueIndex < len) {
            if (currentQueue) {
              currentQueue[queueIndex].run();
            }
          }
          queueIndex = -1;
          len = queue.length;
        }
        currentQueue = null;
        draining = false;
        runClearTimeout(timeout);
      }
      process.nextTick = function(fun) {
        var args = new Array(arguments.length - 1);
        if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
          }
        }
        queue.push(new Item(fun, args));
        if (queue.length === 1 && !draining) {
          runTimeout(drainQueue);
        }
      };
      function Item(fun, array) {
        this.fun = fun;
        this.array = array;
      }
      Item.prototype.run = function() {
        this.fun.apply(null, this.array);
      };
      process.title = "browser";
      process.browser = true;
      process.env = {};
      process.argv = [];
      process.version = "";
      process.versions = {};
      function noop() {
      }
      process.on = noop;
      process.addListener = noop;
      process.once = noop;
      process.off = noop;
      process.removeListener = noop;
      process.removeAllListeners = noop;
      process.emit = noop;
      process.prependListener = noop;
      process.prependOnceListener = noop;
      process.listeners = function(name) {
        return [];
      };
      process.binding = function(name) {
        throw new Error("process.binding is not supported");
      };
      process.cwd = function() {
        return "/";
      };
      process.chdir = function(dir) {
        throw new Error("process.chdir is not supported");
      };
      process.umask = function() {
        return 0;
      };
    }
  });

  // build-inject.js
  var import_buffer, import_process;
  var init_build_inject = __esm({
    "build-inject.js"() {
      "use strict";
      import_buffer = __toESM(require_buffer(), 1);
      import_process = __toESM(require_browser(), 1);
    }
  });

  // src/popup/popup.ts
  init_build_inject();

  // src/shared/messages.ts
  init_build_inject();
  function bgCall(req) {
    return chrome.runtime.sendMessage(req);
  }

  // src/shared/constants.ts
  init_build_inject();
  var PRIVACY_CASH_RELAYER = "https://api3.privacycash.org";
  var LAMPORTS_PER_SOL = 1e9;

  // src/shared/format.ts
  init_build_inject();
  function lamportsToSol(lamports) {
    const n = Number(lamports) / LAMPORTS_PER_SOL;
    if (!isFinite(n)) return "0";
    const s = n.toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
    return s === "" || s === "-0" ? "0" : s;
  }
  function solToLamports(sol) {
    const n = typeof sol === "string" ? Number(sol) : sol;
    if (!isFinite(n) || n < 0) return NaN;
    return Math.round(n * LAMPORTS_PER_SOL);
  }
  function shortAddress(address, head = 4, tail = 4) {
    if (address.length <= head + tail + 1) return address;
    return `${address.slice(0, head)}\u2026${address.slice(-tail)}`;
  }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1e3);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.floor(h / 24);
    return `${d} d ago`;
  }
  function formatWhen(ts) {
    const d = new Date(ts);
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === (/* @__PURE__ */ new Date()).toDateString()) return `today at ${time}`;
    return `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} at ${time}`;
  }

  // src/shared/brand.ts
  init_build_inject();

  // src/shared/emoji.ts
  init_build_inject();
  var KIND_EMOJI = {
    trading: "\u{1F4C8}",
    collecting: "\u{1F5BC}\uFE0F",
    everyday: "\u2615",
    fresh: "\u{1F331}"
  };
  var EMOJI_CHOICES = [
    "\u{1F4C8}",
    "\u{1F5BC}\uFE0F",
    "\u2615",
    "\u{1F331}",
    "\u{1F98A}",
    "\u{1F40B}",
    "\u{1F989}",
    "\u{1F419}",
    "\u{1F43A}",
    "\u{1F438}",
    "\u{1F43C}",
    "\u{1F981}",
    "\u{1F98B}",
    "\u{1F41D}",
    "\u{1F319}",
    "\u2B50",
    "\u{1F525}",
    "\u{1F48E}",
    "\u{1F3AF}",
    "\u{1F3B2}",
    "\u{1F340}",
    "\u{1F680}",
    "\u{1F47E}",
    "\u{1F576}\uFE0F"
  ];
  function graphemes(s) {
    const Seg = Intl.Segmenter;
    if (Seg) return [...new Seg(void 0, { granularity: "grapheme" }).segment(s)].map((g) => g.segment);
    return [...s];
  }
  function isSingleEmoji(value) {
    const s = value.trim();
    if (!s || s.length > 16) return false;
    if (graphemes(s).length !== 1) return false;
    return new RegExp("\\p{Extended_Pictographic}|\\p{Regional_Indicator}", "u").test(s);
  }
  function emojiFor(alias) {
    if (alias.emoji && isSingleEmoji(alias.emoji)) return alias.emoji;
    return alias.kind ? KIND_EMOJI[alias.kind] : null;
  }

  // src/shared/brand.ts
  var MARK_A = "M452,190 L572,190 L854,830 L724,830 L668,702 L356,702 L300,830 L170,830 Z M512,338 L568,478 L456,478 Z M306,560 C362,552 424,546 472,566 C492,574 502,580 512,580 C522,580 532,574 552,566 C600,546 662,552 718,560 C708,604 686,644 640,652 C598,660 560,632 512,632 C464,632 426,660 384,652 C338,644 316,604 306,560 Z";
  var MARK_EYES = "M388,592 C404,582 430,582 446,596 C430,610 404,610 388,592 Z M578,596 C594,582 620,582 636,592 C620,610 594,610 578,596 Z";
  var BRAND = { ink: "#1E1812", lilac: "#AE94F6", paper: "#F7F2E8" };
  function markSvg(size, opts = {}) {
    const tile = opts.tile ?? true;
    const ink = opts.ink ?? BRAND.ink;
    const bg2 = opts.bg ?? BRAND.lilac;
    return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 1024 1024" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${tile ? `<rect width="1024" height="1024" rx="230" fill="${bg2}"/>` : ""}<path fill-rule="evenodd" fill="${ink}" d="${MARK_A}"/><path fill="${ink}" d="${MARK_EYES}"/></svg>`;
  }
  function initialOf(name) {
    const m = /[\p{L}\p{N}]/u.exec(name);
    return m ? m[0].toUpperCase() : "A";
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function aliasTile(alias, size = 32, onLilac = false) {
    const emoji = emojiFor(alias);
    if (emoji) {
      const radius2 = Math.round(size * 0.28);
      return `<span class="tile tile-emoji${onLilac ? " on-lilac" : ""}" style="width:${size}px;height:${size}px;border-radius:${radius2}px;font-size:${Math.round(size * 0.56)}px" aria-hidden="true">${escapeHtml(emoji)}</span>`;
    }
    let variant = Math.abs(alias.avatarSeed) % 4;
    if (onLilac && (variant === 0 || variant === 3)) variant = 1;
    const radius = Math.round(size * 0.28);
    const font = Math.round(size * 0.5);
    return `<span class="tile tile-${variant}" style="width:${size}px;height:${size}px;border-radius:${radius}px;font-size:${font}px" aria-hidden="true">${escapeHtml(initialOf(alias.name))}</span>`;
  }
  function siteTile(host, size = 36) {
    const radius = Math.round(size * 0.28);
    return `<span class="tile tile-site" style="width:${size}px;height:${size}px;border-radius:${radius}px;font-size:${Math.round(size * 0.48)}px" aria-hidden="true">${escapeHtml(initialOf(host.replace(/^www\./, "")))}</span>`;
  }
  function smallMarkSvg(size, opts = {}) {
    const mask = opts.mask ?? size >= 20;
    const a = "M12.9,3 L19.1,3 L29.4,29 L22.6,29 L20.9,24.4 L11.1,24.4 L9.4,29 L2.6,29 Z M16,9.2 L18.6,16.4 L13.4,16.4 Z";
    const slit = mask ? " M10.2,18.6 C12.6,18.1 14.3,18.6 16,19.6 C17.7,18.6 19.4,18.1 21.8,18.6 C21.3,21.1 19.7,22.1 18.1,21.8 C17.2,21.6 16.6,21.2 16,21.2 C15.4,21.2 14.8,21.6 13.9,21.8 C12.3,22.1 10.7,21.1 10.2,18.6 Z" : "";
    return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="${BRAND.lilac}"/><path fill-rule="evenodd" fill="${BRAND.ink}" d="${a}${slit}"/></svg>`;
  }

  // src/popup/popup.ts
  var app = document.getElementById("app");
  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function screen(html, opts = {}) {
    app.innerHTML = `<div class="screen${opts.scroll ? " screen-scroll" : ""}">${html}</div>`;
  }
  function on(selector, event, handler) {
    app.querySelectorAll(selector).forEach((el) => {
      el.addEventListener(event, (e) => handler(e, el));
    });
  }
  function val(selector) {
    return app.querySelector(selector)?.value ?? "";
  }
  function mark(size = 48) {
    return markSvg(size);
  }
  function avatar(alias, size = 32, onLilac = false) {
    return aliasTile(alias, size, onLilac);
  }
  var COPY_ICON = `<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 3.5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6.5A1.5 1.5 0 0 0 3 11h.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  function topbar(title, backRoute) {
    return `<div class="topbar">
    ${backRoute ? `<button class="back" data-nav="${backRoute}">\u2039 Back</button>` : "<span></span>"}
    <span class="title">${esc(title)}</span>
    <span style="width:44px"></span>
  </div>`;
  }
  async function bg(req) {
    const res = await bgCall(req);
    if (!res.ok) throw new Error(res.error?.message ?? "Something went wrong");
    return res.result;
  }
  function wireNav() {
    on("[data-nav]", "click", (_e, el) => {
      location.hash = el.dataset.nav;
    });
  }
  function showError(message) {
    const slot = app.querySelector(".error-text");
    if (slot) slot.textContent = message;
  }
  var aliasList = [];
  var settings = null;
  var selectedAliasId = localStorage.getItem("alias.selected");
  function currentAlias() {
    return aliasList.find((a) => a.id === selectedAliasId) ?? aliasList[0] ?? null;
  }
  async function refreshCore() {
    [aliasList, settings] = await Promise.all([bg({ type: "alias.list" }), bg({ type: "settings.get" })]);
  }
  async function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const isApproval = hash.startsWith("/approve/");
    document.body.classList.toggle("windowed", isApproval);
    const status = await bg({ type: "vault.status" });
    if (!status.exists) {
      if (hash === "/onboard/password") return renderOnboardPassword();
      if (hash === "/onboard/import") return renderOnboardImport();
      return renderWelcome();
    }
    if (!status.unlocked) return renderUnlock(hash);
    await refreshCore();
    if (isApproval) return renderApproval(hash.split("/")[2]);
    if (hash === "/create-alias") return renderCreateAlias();
    if (hash === "/fund") return renderFund();
    if (hash === "/return") return renderReturn();
    if (hash === "/settings") return renderSettings();
    if (hash === "/settings/mainnet") return renderMainnetConsent();
    if (hash === "/settings/sites") return renderSites();
    if (hash === "/settings/phrase") return renderRevealPhrase();
    if (hash === "/history") return renderHistory();
    if (hash === "/aliases") return renderAliases();
    if (hash === "/alias/edit") return renderEditAlias();
    if (hash.startsWith("/phrase-backup")) return renderPhraseBackup();
    if (aliasList.length === 0) return renderCreateAlias(true);
    return renderHome();
  }
  window.addEventListener("hashchange", () => void route());
  function renderWelcome() {
    screen(`
    <div class="intro grow">
      ${mark(52)}
      <h1 class="display">One wallet per app.<br />No link back to you.</h1>
      <p class="lede">Alias gives every site its own address and funds it through Privacy Cash, so your main wallet stays separate.</p>
      <ul class="facts">
        <li><b>Separate aliases</b><span>For trading, NFTs, or one per site</span></li>
        <li><b>Private funding</b><span>No transaction links your wallets</span></li>
        <li><b>One recovery phrase</b><span>12 words restore every alias</span></li>
      </ul>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" data-nav="/onboard/password">Create my vault</button>
      <button class="btn btn-ghost" data-nav="/onboard/import">I have a recovery phrase</button>
    </div>
  `);
    wireNav();
  }
  function renderOnboardPassword() {
    screen(`
    ${topbar("Set a password", "/")}
    <div class="stack">
      <p class="muted">This password unlocks Alias on this computer. It never leaves your device.</p>
      <input id="pw1" class="field" type="password" placeholder="Password (8+ characters)" autocomplete="new-password" />
      <input id="pw2" class="field" type="password" placeholder="Repeat password" autocomplete="new-password" />
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="create">Continue</button>
    </div>
  `);
    wireNav();
    on("#create", "click", async () => {
      const p1 = val("#pw1");
      const p2 = val("#pw2");
      if (p1 !== p2) return showError("The passwords do not match");
      try {
        const { mnemonic } = await bg({ type: "vault.create", password: p1 });
        sessionStorage.setItem("alias.new-mnemonic", mnemonic);
        location.hash = "/phrase-backup";
      } catch (e) {
        showError(e.message);
      }
    });
  }
  function renderPhraseBackup() {
    const mnemonic = sessionStorage.getItem("alias.new-mnemonic") ?? "";
    const words = mnemonic.split(" ");
    screen(`
    ${topbar("Your recovery phrase")}
    <div class="stack">
      <p class="muted small">These 12 words recover every alias and its funds. Write them down and keep them offline. This is the one recovery step.</p>
      <div class="phrase-grid">
        ${words.map((w, i) => `<div class="phrase-word"><i>${i + 1}</i>${esc(w)}</div>`).join("")}
      </div>
      <label class="check-row"><input type="checkbox" id="saved" /> I wrote these 12 words down somewhere safe.</label>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="done">Continue</button>
    </div>
  `);
    on("#done", "click", () => {
      if (!app.querySelector("#saved").checked) {
        return showError("Please confirm you wrote the phrase down");
      }
      sessionStorage.removeItem("alias.new-mnemonic");
      location.hash = "/create-alias";
    });
  }
  function renderOnboardImport() {
    screen(`
    ${topbar("Restore from phrase", "/")}
    <div class="stack">
      <textarea id="mn" class="field" rows="3" placeholder="Enter your 12 or 24 word recovery phrase"></textarea>
      <input id="pw1" class="field" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" />
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="restore">Restore</button>
    </div>
  `);
    wireNav();
    on("#restore", "click", async () => {
      try {
        await bg({ type: "vault.importMnemonic", password: val("#pw1"), mnemonic: val("#mn") });
        location.hash = "/create-alias";
      } catch (e) {
        showError(e.message);
      }
    });
  }
  function renderUnlock(nextHash) {
    screen(`
    <div class="intro grow">
      ${mark(52)}
      <h1 class="display">Welcome back</h1>
      <p class="lede">Unlock to use your aliases. Your password never leaves this computer.</p>
      <div class="stack" style="margin-top:6px">
        <input id="pw" class="field" type="password" placeholder="Password" autocomplete="current-password" aria-label="Password" />
        <div class="error-text"></div>
      </div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="unlock">Unlock</button>
    </div>
  `);
    const go = async () => {
      try {
        await bg({ type: "vault.unlock", password: val("#pw") });
        location.hash = nextHash === "/" ? "" : `#${nextHash}`;
        void route();
      } catch (e) {
        showError(e.message);
      }
    };
    on("#unlock", "click", go);
    on("#pw", "keydown", (e) => {
      if (e.key === "Enter") void go();
    });
    app.querySelector("#pw").focus();
  }
  var ICONS = {
    home: `<svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 9.2 10 3.5l7 5.7V16a1 1 0 0 1-1 1h-3.6v-4.6H7.6V17H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    activity: `<svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 6.2V10l2.6 1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    settings: `<svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    chevron: `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    in: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v10M3.8 8.6 8 12.8l4.2-4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    out: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.5v-10M3.8 7.4 8 3.2l4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };
  function navBar(active) {
    const item = (key, label, route2) => `<button class="${active === key ? "active" : ""}" ${active === key ? 'aria-current="page"' : `data-nav="${route2}"`}>${ICONS[key]}<span>${label}</span></button>`;
    return `<nav class="nav" aria-label="Main">${item("home", "Home", "/")}${item("activity", "Activity", "/history")}${item("settings", "Settings", "/settings")}</nav>`;
  }
  function opStatus(op) {
    if (op.step === "done") return { label: "Done", cls: "chip-mint" };
    if (op.step === "failed") return { label: "Failed", cls: "chip-coral" };
    if (op.step === "deposit-confirmed" && op.payAfter && op.payAfter > Date.now()) return { label: "Scheduled", cls: "chip-lilac" };
    if (op.step === "unknown") return { label: "Check status", cls: "chip-lilac" };
    return { label: "In progress", cls: "chip-lilac" };
  }
  function activityRow(op, aliasName) {
    const st = opStatus(op);
    const fund = op.kind === "fund";
    return `<button class="act-row" data-op="${op.id}">
    <span class="act-icon ${fund ? "in" : "out"}">${fund ? ICONS.in : ICONS.out}</span>
    <span class="act-meta"><span class="one">${fund ? "Funded privately" : "Returned privately"}</span><span class="two num">${aliasName ? `${esc(aliasName)} \xB7 ` : ""}${lamportsToSol(op.amountLamports)} SOL \xB7 ${timeAgo(op.createdAt)}</span></span>
    <span class="chip ${st.cls}">${st.label}</span>
  </button>`;
  }
  async function renderHome() {
    const alias = currentAlias();
    if (!alias) return renderCreateAlias(true);
    selectedAliasId = alias.id;
    localStorage.setItem("alias.selected", alias.id);
    const net = settings.network;
    const netChip = net === "mainnet-beta" ? `<span class="chip chip-coral" title="Real funds">Mainnet</span>` : `<span class="chip chip-lilac">Devnet</span>`;
    screen(`
    <div class="topbar">
      <span class="brandline">${smallMarkSvg(22)}<span>Alias</span></span>
      ${netChip}
    </div>
    <div class="home">
      <div class="alias-card">
        <div class="card-head">
          <button class="avatar-btn" id="edit-alias" title="Change emoji and name" aria-label="Change emoji and name">${avatar(alias, 40, true)}</button>
          <div class="head-text">
            <button class="switcher" data-nav="/aliases" aria-label="Switch alias"><span class="alias-name">${esc(alias.name)}</span>${ICONS.chevron}</button>
            <div id="site-chip" class="site-line"></div>
          </div>
        </div>
        <div class="alias-balance num" id="balance">\u2026</div>
        <div class="alias-foot">
          <button class="addr num" id="copy-addr" title="${esc(alias.address)}" aria-label="Copy alias address"><span id="addr-text">${shortAddress(alias.address, 5, 5)}</span>${COPY_ICON}</button>
          <span class="alias-note" id="fund-status">&nbsp;</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-nav="/fund">Fund privately</button>
        <button class="btn btn-outline" data-nav="/return">Return privately</button>
      </div>
      <div id="pending"></div>
      <section class="home-activity" aria-label="Activity">
        <div class="section-head"><span>Activity</span><button class="link-quiet" data-nav="/history">See all</button></div>
        <div id="activity"></div>
      </section>
    </div>
    ${navBar("home")}
  `);
    wireNav();
    on("#edit-alias", "click", () => {
      location.hash = "/alias/edit";
    });
    on("#copy-addr", "click", async () => {
      await navigator.clipboard.writeText(alias.address);
      const t = app.querySelector("#addr-text");
      if (!t) return;
      t.textContent = "Copied";
      setTimeout(() => t.textContent = shortAddress(alias.address, 5, 5), 900);
    });
    bg({ type: "alias.balance", id: alias.id }).then(({ lamports }) => {
      const b = app.querySelector("#balance");
      if (b) b.textContent = `${lamportsToSol(lamports)} SOL`;
    }).catch(() => {
      const b = app.querySelector("#balance");
      if (b) b.textContent = "Balance unavailable";
    });
    bg({ type: "ops.list" }).then((ops) => {
      const now = Date.now();
      const waiting = ops.filter((o) => o.step === "deposit-confirmed" && !o.withdrawTx);
      const ready = waiting.filter((o) => !o.payAfter || o.payAfter <= now);
      if (ready.length === 0) void chrome.action?.setBadgeText({ text: "" }).catch(() => void 0);
      const op = ready[0] ?? waiting[0];
      const slot = app.querySelector("#pending");
      if (op && slot) {
        const isReady = !op.payAfter || op.payAfter <= now;
        const payee = op.kind === "fund" ? aliasList.find((a) => a.id === op.aliasId)?.name ?? "your alias" : "your main wallet";
        slot.innerHTML = `<div class="card pending${isReady ? " ready" : ""}">
          <div class="meta">
            <div class="one">${lamportsToSol(op.amountLamports)} SOL ${isReady ? "ready in the pool" : "waiting in the pool"}</div>
            <div class="two">${isReady ? `Next: pay ${esc(payee)}` : `Pays ${esc(payee)} ${esc(formatWhen(op.payAfter))}`}</div>
          </div>
          <button class="btn-mini" id="pay-op">${isReady ? "Pay" : "Pay now"}</button>
        </div>`;
        on("#pay-op", "click", async () => {
          try {
            await bg({ type: "ops.open", id: op.id, payNow: true });
            window.close();
          } catch {
          }
        });
      }
      const mine = ops.filter((o) => o.aliasId === alias.id);
      const status = app.querySelector("#fund-status");
      if (status) {
        const funded = mine.some((o) => o.kind === "fund" && o.step === "done");
        const funding = mine.some((o) => o.kind === "fund" && !["done", "failed"].includes(o.step));
        status.textContent = funded ? "Funded privately \xB7 no direct link to your main wallet" : funding ? "Private funding in progress" : "Not funded yet";
      }
      const list = app.querySelector("#activity");
      if (!list) return;
      if (mine.length === 0) {
        list.innerHTML = `<ol class="getting-started">
          <li><b>Fund this alias</b><span>from your main wallet, privately</span></li>
          <li><b>Connect it</b><span>on a site like Jupiter</span></li>
          <li><b>Return funds</b><span>the same private way</span></li>
        </ol>`;
        return;
      }
      const max = op ? 2 : 3;
      list.innerHTML = mine.slice(0, max).map((o) => activityRow(o)).join("");
      on("[data-op]", "click", async (_e, el) => {
        await bg({ type: "ops.open", id: el.dataset.op, payNow: false }).catch(() => void 0);
        window.close();
      });
    }).catch(() => void 0);
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab?.url?.startsWith("http")) {
        const origin = new URL(tab.url).origin;
        const grants = await bg({ type: "origins.list" });
        const grant = grants.find((g) => g.origin === origin);
        const slot = app.querySelector("#site-chip");
        if (slot && grant) {
          const who = aliasList.find((a) => a.id === grant.aliasId);
          slot.innerHTML = `<span class="conn-dot" aria-hidden="true"></span>Connected to ${esc(new URL(origin).hostname)}${who && who.id !== alias.id ? ` as ${esc(who.name)}` : ""}`;
        }
      }
    } catch {
    }
  }
  function renderEditAlias() {
    const alias = currentAlias();
    if (!alias) return void (location.hash = "/");
    let chosen = emojiFor(alias) ?? "";
    screen(`
    ${topbar("Edit alias", "/")}
    <div class="stack grow">
      <div class="edit-head">
        <span id="preview">${avatar(alias, 56)}</span>
        <input id="name" class="field" value="${esc(alias.name)}" maxlength="40" aria-label="Alias name" />
      </div>
      <div class="field-label" style="margin-top:4px">Pick an emoji</div>
      <div class="emoji-grid" role="group" aria-label="Emoji">
        ${EMOJI_CHOICES.map((e) => `<button class="emoji-opt${e === chosen ? " active" : ""}" data-emoji="${e}" aria-label="${e}">${e}</button>`).join("")}
      </div>
      <label class="field-label">Or type any emoji<input id="custom" class="field" placeholder="For example \u{1F422}" maxlength="16" /></label>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="save">Save</button>
    </div>
  `);
    wireNav();
    const paint = () => {
      const preview = app.querySelector("#preview");
      if (preview) preview.innerHTML = avatar({ ...alias, emoji: chosen || alias.emoji }, 56);
      app.querySelectorAll(".emoji-opt").forEach((b) => b.classList.toggle("active", b.dataset.emoji === chosen));
    };
    on(".emoji-opt", "click", (_e, el) => {
      chosen = el.dataset.emoji;
      app.querySelector("#custom").value = "";
      showError("");
      paint();
    });
    on("#custom", "input", (_e, el) => {
      const v = el.value.trim();
      if (!v) return;
      if (isSingleEmoji(v)) {
        chosen = v;
        showError("");
        paint();
      } else {
        showError("Type a single emoji");
      }
    });
    on("#save", "click", async () => {
      try {
        const updated = await bg({ type: "alias.update", id: alias.id, name: val("#name"), emoji: chosen || void 0 });
        const i = aliasList.findIndex((a) => a.id === updated.id);
        if (i >= 0) aliasList[i] = updated;
        location.hash = "/";
      } catch (e) {
        showError(e.message);
      }
    });
  }
  var ALIASES_PER_PAGE = 5;
  function renderAliases(page = 0) {
    const pages = Math.max(1, Math.ceil(aliasList.length / ALIASES_PER_PAGE));
    page = Math.min(Math.max(0, page), pages - 1);
    const slice = aliasList.slice(page * ALIASES_PER_PAGE, (page + 1) * ALIASES_PER_PAGE);
    const current = currentAlias();
    screen(`
    ${topbar("Your aliases", "/")}
    <div class="stack grow">
      ${slice.map(
      (a) => `<button class="card list-item" data-alias="${a.id}" style="text-align:left;${a.id === current?.id ? "border-color:var(--lilac);background:var(--lilac-soft)" : ""}">
            ${avatar(a, 30)}
            <div class="meta"><div class="one">${esc(a.name)}</div><div class="two num" title="${esc(a.address)}">${shortAddress(a.address, 5, 5)}</div></div>
          </button>`
    ).join("")}
      ${pages > 1 ? `<div class="pager"><button class="icon-btn" id="prev" aria-label="Previous page" ${page === 0 ? "disabled" : ""}>\u2039</button><span class="num">${page + 1} / ${pages}</span><button class="icon-btn" id="next" aria-label="Next page" ${page === pages - 1 ? "disabled" : ""}>\u203A</button></div>` : ""}
    </div>
    <div class="bottom">
      <button class="btn btn-outline" data-nav="/create-alias">New alias</button>
    </div>
  `);
    wireNav();
    on("[data-alias]", "click", (_e, el) => {
      selectedAliasId = el.dataset.alias;
      localStorage.setItem("alias.selected", selectedAliasId);
      location.hash = "/";
    });
    on("#prev", "click", () => renderAliases(page - 1));
    on("#next", "click", () => renderAliases(page + 1));
  }
  function renderCreateAlias(first = false) {
    let kind = "trading";
    screen(`
    ${topbar(first ? "Create your first alias" : "New alias", first ? void 0 : "/")}
    <div class="stack">
      <p class="muted small">${first ? "An alias is a separate wallet identity. Start with one for trading." : "Each alias is a separate identity with its own address."}</p>
      <div class="kind-grid" id="kinds">
        <button class="kind-option active" data-kind="trading"><span class="tile tile-emoji k-tile">${KIND_EMOJI.trading}</span><strong>Trading</strong><span>DEXes and swaps</span></button>
        <button class="kind-option" data-kind="collecting"><span class="tile tile-emoji k-tile">${KIND_EMOJI.collecting}</span><strong>Collecting</strong><span>NFT apps</span></button>
        <button class="kind-option" data-kind="everyday"><span class="tile tile-emoji k-tile">${KIND_EMOJI.everyday}</span><strong>Everyday</strong><span>General use</span></button>
        <button class="kind-option" data-kind="fresh"><span class="tile tile-emoji k-tile">${KIND_EMOJI.fresh}</span><strong>Fresh</strong><span>One site only</span></button>
      </div>
      <input id="name" class="field" placeholder="Name (optional)" />
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="create">Create alias</button>
    </div>
  `);
    wireNav();
    on("[data-kind]", "click", (_e, el) => {
      kind = el.dataset.kind;
      app.querySelectorAll(".kind-option").forEach((o) => o.classList.remove("active"));
      el.classList.add("active");
    });
    on("#create", "click", async () => {
      try {
        const info = await bg({ type: "alias.create", name: val("#name"), kind });
        selectedAliasId = info.id;
        localStorage.setItem("alias.selected", info.id);
        location.hash = "";
        void route();
      } catch (e) {
        showError(e.message);
      }
    });
  }
  async function fetchFeeConfig() {
    try {
      const res = await fetch(`${PRIVACY_CASH_RELAYER}/config`);
      if (!res.ok) return null;
      const json = await res.json();
      if (typeof json.withdraw_fee_rate !== "number" || typeof json.withdraw_rent_fee !== "number") return null;
      return {
        withdraw_fee_rate: json.withdraw_fee_rate,
        withdraw_rent_fee_sol: json.withdraw_rent_fee,
        minimum_sol: typeof json.minimum_withdrawal?.sol === "number" ? json.minimum_withdrawal.sol : void 0
      };
    } catch {
      return null;
    }
  }
  function poolFeeLamports(lam, config) {
    return Math.floor(lam * config.withdraw_fee_rate + config.withdraw_rent_fee_sol * 1e9);
  }
  var DELAY_KEY = "alias.payoutDelay";
  var DELAYS = [0, 60, 1440];
  function savedDelay() {
    try {
      const v = Number(localStorage.getItem(DELAY_KEY));
      return DELAYS.includes(v) ? v : 0;
    } catch {
      return 0;
    }
  }
  function timingControl() {
    return `<div class="seg" id="when" role="group" aria-label="When the pool pays out">
    <button data-delay="0">Right away</button>
    <button data-delay="60">In 1 hour</button>
    <button data-delay="1440">Tomorrow</button>
  </div>
  <p class="small muted when-note" id="when-note"></p>`;
  }
  function wireTiming() {
    let delay = savedDelay();
    const paint = () => {
      app.querySelectorAll("#when [data-delay]").forEach((b) => {
        const active = Number(b.dataset.delay) === delay;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      const note = app.querySelector("#when-note");
      if (note) {
        note.textContent = delay === 0 ? "Fastest, but a deposit and a payout of almost the same amount minutes apart are easier to match." : "Your SOL waits in the pool until then. Spacing the two transactions out makes them harder to match.";
      }
    };
    on("#when [data-delay]", "click", (_e, el) => {
      delay = Number(el.dataset.delay);
      try {
        localStorage.setItem(DELAY_KEY, String(delay));
      } catch {
      }
      paint();
    });
    paint();
    return () => delay;
  }
  function privacyGate() {
    if (settings.network !== "mainnet-beta" || !settings.mainnetEnabled) {
      return `Privacy Cash runs on Solana mainnet only. Enable mainnet in Settings to fund privately.`;
    }
    return null;
  }
  async function renderFund() {
    const alias = currentAlias();
    const gate = privacyGate();
    screen(`
    ${topbar("Fund privately", "/")}
    <div class="stack grow">
      <div class="card site-banner">${avatar(alias)}<div><div style="font-weight:800">${esc(alias.name)}</div><div class="small muted">receives through Privacy Cash</div></div></div>
      ${gate ? `<div class="notice amber">${esc(gate)}</div>` : `
      <div class="amount-input"><input id="amount" inputmode="decimal" placeholder="0.05" /><span class="unit">SOL</span></div>
      <div class="card" style="padding:11px 13px">
        <div class="kv"><span class="k">From</span><span class="v">Your main wallet (chosen next)</span></div>
        <div class="kv"><span class="k">Pool fee (estimate)</span><span class="v" id="fee">\u2026</span></div>
        <div class="kv"><span class="k">Alias receives (estimate)</span><span class="v" id="net">\u2026</span></div>
      </div>
      <div class="small" style="font-weight:800">Pool pays the alias</div>
      ${timingControl()}
      <div class="error-text"></div>`}
    </div>
    <div class="bottom">
      ${gate ? `<button class="btn btn-primary" data-nav="/settings/mainnet">Enable mainnet</button>` : `<button class="btn btn-primary" id="go">Continue</button>`}
    </div>
  `);
    wireNav();
    if (gate) return;
    const getDelay = wireTiming();
    const config = await fetchFeeConfig();
    const update = () => {
      const lam = solToLamports(val("#amount") || "0");
      const feeEl = app.querySelector("#fee");
      const netEl = app.querySelector("#net");
      if (!feeEl || !netEl) return;
      if (!config) {
        feeEl.textContent = "unavailable";
        netEl.textContent = "unavailable";
        return;
      }
      if (!(lam > 0)) {
        feeEl.textContent = "-";
        netEl.textContent = "-";
        return;
      }
      const fee = poolFeeLamports(lam, config);
      const min = config.minimum_sol !== void 0 ? solToLamports(config.minimum_sol) : 0;
      if (min && lam < min) {
        feeEl.textContent = `min ${config.minimum_sol} SOL`;
        netEl.textContent = "-";
        return;
      }
      feeEl.textContent = `\u2248 ${lamportsToSol(fee)} SOL`;
      netEl.textContent = `\u2248 ${lamportsToSol(Math.max(0, lam - fee))} SOL`;
    };
    on("#amount", "input", update);
    update();
    on("#go", "click", async () => {
      const lam = solToLamports(val("#amount"));
      if (!(lam > 0)) return showError("Enter an amount first");
      if (!config) return showError("Could not load live Privacy Cash fees. Check your connection and try again.");
      try {
        await bg({
          type: "ops.start",
          kind: "fund",
          aliasId: alias.id,
          amountLamports: lam,
          delayMinutes: getDelay()
        });
        screen(`
        <div class="intro grow">${mark(52)}<h1 class="display">Continue in the Alias window</h1><p class="lede">The funding steps run in the small window that just opened.</p></div>
        <div class="bottom"><button class="btn btn-primary" data-nav="/">Done</button></div>`);
        wireNav();
      } catch (e) {
        showError(e.message);
      }
    });
  }
  async function renderReturn() {
    const alias = currentAlias();
    const gate = privacyGate();
    let balance = 0;
    try {
      balance = (await bg({ type: "alias.balance", id: alias.id })).lamports;
    } catch {
    }
    let known = null;
    try {
      const ops = await bg({ type: "ops.list" });
      const funded = ops.find((o) => o.kind === "fund" && o.mainWallet);
      if (funded?.mainWallet) known = { address: funded.mainWallet, name: funded.mainWalletName };
    } catch {
    }
    screen(`
    ${topbar("Return privately", "/")}
    <div class="stack grow">
      <div class="card site-banner">${avatar(alias)}<div><div style="font-weight:800">${esc(alias.name)}</div><div class="small muted">has ${lamportsToSol(balance)} SOL</div></div></div>
      ${gate ? `<div class="notice amber">${esc(gate)}</div>` : `
      ${known ? `<div class="card dest-known" id="dest-known">
              <div class="meta"><div class="one">To your main wallet</div><div class="two mono" title="${esc(known.address)}">${known.name ? `${esc(known.name)} \xB7 ` : ""}${esc(shortAddress(known.address, 5, 5))}</div></div>
              <button class="link-btn" id="dest-change">Change</button>
            </div>` : ""}
      <input id="dest" class="field" placeholder="Destination address (your main wallet)" value="${known ? esc(known.address) : ""}" ${known ? "hidden" : ""} />
      <div class="amount-input"><input id="amount" inputmode="decimal" placeholder="0.05" /><span class="unit">SOL</span></div>
      <div class="card" style="padding:11px 13px">
        <div class="kv"><span class="k">Pool fee (estimate)</span><span class="v" id="fee">\u2026</span></div>
        <div class="kv"><span class="k">Destination receives (estimate)</span><span class="v" id="net">\u2026</span></div>
      </div>
      <div class="small" style="font-weight:800">Pool pays the destination <span class="muted" style="font-weight:600">(keep \u22480.003 SOL in the alias for fees)</span></div>
      ${timingControl()}
      <div class="error-text"></div>`}
    </div>
    <div class="bottom">
      ${gate ? `<button class="btn btn-primary" data-nav="/settings/mainnet">Enable mainnet</button>` : `<button class="btn btn-primary" id="go">Continue</button>`}
    </div>
  `);
    wireNav();
    if (gate) return;
    const getDelay = wireTiming();
    on("#dest-change", "click", () => {
      app.querySelector("#dest-known")?.remove();
      const field = app.querySelector("#dest");
      field.hidden = false;
      field.value = "";
      field.focus();
    });
    const config = await fetchFeeConfig();
    const update = () => {
      const lam = solToLamports(val("#amount") || "0");
      const feeEl = app.querySelector("#fee");
      const netEl = app.querySelector("#net");
      if (!feeEl || !netEl) return;
      if (!config) {
        feeEl.textContent = "unavailable";
        netEl.textContent = "unavailable";
        return;
      }
      if (!(lam > 0)) {
        feeEl.textContent = "-";
        netEl.textContent = "-";
        return;
      }
      const fee = poolFeeLamports(lam, config);
      const min = config.minimum_sol !== void 0 ? solToLamports(config.minimum_sol) : 0;
      if (min && lam < min) {
        feeEl.textContent = `min ${config.minimum_sol} SOL`;
        netEl.textContent = "-";
        return;
      }
      feeEl.textContent = `\u2248 ${lamportsToSol(fee)} SOL`;
      netEl.textContent = `\u2248 ${lamportsToSol(Math.max(0, lam - fee))} SOL`;
    };
    on("#amount", "input", update);
    update();
    on("#go", "click", async () => {
      const lam = solToLamports(val("#amount"));
      const dest = val("#dest").trim();
      if (!dest) return showError("Enter the destination address");
      if (!(lam > 0)) return showError("Enter an amount first");
      if (!config) return showError("Could not load live Privacy Cash fees. Check your connection and try again.");
      try {
        await bg({
          type: "ops.start",
          kind: "return",
          aliasId: alias.id,
          amountLamports: lam,
          destination: dest,
          delayMinutes: getDelay()
        });
        screen(`
        <div class="intro grow">${mark(52)}<h1 class="display">Continue in the Alias window</h1><p class="lede">The return steps run in the small window that just opened.</p></div>
        <div class="bottom"><button class="btn btn-primary" data-nav="/">Done</button></div>`);
        wireNav();
      } catch (e) {
        showError(e.message);
      }
    });
  }
  async function renderHistory() {
    const ops = await bg({ type: "ops.list" });
    screen(`
    ${topbar("Activity", "/")}
    <div class="grow history">
      ${ops.length === 0 ? `<p class="muted small" style="margin-top:8px">No activity yet. Fund an alias privately and it shows up here.</p>` : `<div id="activity">${ops.slice(0, 30).map((op) => activityRow(op, aliasList.find((a) => a.id === op.aliasId)?.name ?? "Alias")).join("")}</div>`}
    </div>
    <div class="bottom">
      <button class="btn btn-outline" id="manager">Full history and recovery</button>
    </div>
  `);
    wireNav();
    on("[data-op]", "click", async (_e, el) => {
      await bg({ type: "ops.open", id: el.dataset.op, payNow: false }).catch(() => void 0);
    });
    on("#manager", "click", () => {
      void chrome.tabs.create({ url: chrome.runtime.getURL("manager/manager.html") });
    });
  }
  async function renderSettings() {
    const s = settings;
    const advancedOpen = Boolean(s.customRpc);
    screen(`
    ${topbar("Settings", "/")}
    <div class="stack grow settings">
      <div class="seg" id="net" role="group" aria-label="Network">
        <button data-net="devnet" class="${s.network === "devnet" ? "active" : ""}">Devnet</button>
        <button data-net="mainnet-beta" class="${s.network === "mainnet-beta" ? "active" : ""}">Mainnet</button>
      </div>
      ${s.mainnetEnabled ? "" : `<p class="small muted">Mainnet is off until you agree to use real funds. <a href="#/settings/mainnet">Enable mainnet</a></p>`}
      <div class="card group">
        <label class="row-field"><span class="rf-text"><b>Per-transaction limit</b><small>Spending on sites (mainnet)</small></span><span class="unit-input"><input id="txLimit" value="${s.perTransactionSol}" inputmode="decimal" aria-label="Per-transaction limit in SOL" /><em>SOL</em></span></label>
        <label class="row-field"><span class="rf-text"><b>Per-transfer limit</b><small>Fund and return privately</small></span><span class="unit-input"><input id="opLimit" value="${s.perOperationSol}" inputmode="decimal" aria-label="Per-transfer limit in SOL" /><em>SOL</em></span></label>
      </div>
      <div class="card group">
        <button class="row-link" data-nav="/settings/sites"><span>Connected sites</span><span class="chev" aria-hidden="true">\u203A</span></button>
        <button class="row-link" data-nav="/settings/phrase"><span>Recovery phrase</span><span class="chev" aria-hidden="true">\u203A</span></button>
        <button class="row-link" id="lock"><span>Lock Alias</span><span class="chev" aria-hidden="true">\u203A</span></button>
      </div>
      <details class="card group adv"${advancedOpen ? " open" : ""}>
        <summary class="row-link"><span>Advanced</span><span class="chev" aria-hidden="true">\u203A</span></summary>
        <div class="adv-body">
          <label class="field-label">Funding page<input id="companion" class="field" value="${esc(s.companionUrl)}" /></label>
          <label class="field-label">Your own RPC (optional, tried first)<input id="rpc" class="field" placeholder="https://\u2026" value="${esc(s.customRpc ?? "")}" /></label>
        </div>
      </details>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="save">Save</button>
    </div>
  `);
    wireNav();
    on("[data-net]", "click", async (_e, el) => {
      const net = el.dataset.net;
      if (net === "mainnet-beta" && !s.mainnetEnabled) {
        location.hash = "/settings/mainnet";
        return;
      }
      try {
        settings = await bg({ type: "settings.update", patch: { network: net } });
        void renderSettings();
      } catch (e) {
        showError(e.message);
      }
    });
    on("#save", "click", async () => {
      try {
        settings = await bg({
          type: "settings.update",
          patch: {
            perOperationSol: Number(val("#opLimit")),
            perTransactionSol: Number(val("#txLimit")),
            companionUrl: val("#companion").trim(),
            customRpc: val("#rpc").trim()
          }
        });
        location.hash = "";
        void route();
      } catch (e) {
        showError(e.message);
      }
    });
    on("#lock", "click", async () => {
      await bg({ type: "vault.lock" });
      void route();
    });
  }
  function renderMainnetConsent() {
    screen(`
    ${topbar("Enable mainnet", "/settings")}
    <div class="stack grow">
      <div class="notice coral">Mainnet uses real SOL. A mistake can cost real money.</div>
      <div class="card rows">
        <div class="row-item"><div class="k">Every transaction</div><div class="v">Asks you first</div></div>
        <div class="row-item"><div class="k">Spending limits</div><div class="v num">${settings.perTransactionSol} SOL per transaction \xB7 ${settings.perOperationSol} SOL per private transfer</div></div>
        <div class="row-item"><div class="k">Privacy</div><div class="v">Separate addresses, not anonymity. Timing, amounts and off-chain data can still link activity.</div></div>
      </div>
      <label class="check-row"><input type="checkbox" id="agree" /> I understand this uses real funds and I keep my own limits in mind.</label>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="enable">Enable mainnet</button>
    </div>
  `);
    wireNav();
    on("#enable", "click", async () => {
      if (!app.querySelector("#agree").checked) return showError("Tick the box to continue");
      try {
        settings = await bg({
          type: "settings.update",
          patch: { mainnetEnabled: true, network: "mainnet-beta" }
        });
        location.hash = "/settings";
      } catch (e) {
        showError(e.message);
      }
    });
  }
  async function renderSites() {
    const grants = await bg({ type: "origins.list" });
    screen(`
    ${topbar("Connected sites", "/settings")}
    <div class="list grow">
      ${grants.length === 0 ? `<p class="muted" style="text-align:center;margin-top:40px">No sites connected yet.</p>` : grants.map((g) => {
      const alias = aliasList.find((a) => a.id === g.aliasId);
      return `<div class="card list-item">
                  <div class="meta"><div class="one">${esc(new URL(g.origin).hostname)}</div><div class="two">${esc(alias?.name ?? "Alias")}</div></div>
                  <button class="btn-ghost" style="background:none;color:#9c3a22;font-weight:700" data-revoke="${esc(g.origin)}">Remove</button>
                </div>`;
    }).join("")}
    </div>
  `);
    wireNav();
    on("[data-revoke]", "click", async (_e, el) => {
      await bg({ type: "origins.revoke", origin: el.dataset.revoke });
      void renderSites();
    });
  }
  function renderRevealPhrase() {
    screen(`
    ${topbar("Recovery phrase", "/settings")}
    <div class="stack grow">
      <p class="muted small">Enter your password to show the 12 words. Anyone with them controls every alias.</p>
      <input id="pw" class="field" type="password" placeholder="Password" />
      <div id="out"></div>
      <div class="error-text"></div>
    </div>
    <div class="bottom"><button class="btn btn-primary" id="show">Show phrase</button></div>
  `);
    wireNav();
    on("#show", "click", async () => {
      try {
        const { mnemonic } = await bg({ type: "vault.revealMnemonic", password: val("#pw") });
        const out = app.querySelector("#out");
        out.innerHTML = `<div class="phrase-grid">${mnemonic.split(" ").map((w, i) => `<div class="phrase-word"><i>${i + 1}</i>${esc(w)}</div>`).join("")}</div>`;
      } catch (e) {
        showError(e.message);
      }
    });
  }
  async function renderApproval(requestId) {
    let payload;
    try {
      payload = await bg({ type: "approval.get", requestId });
    } catch {
      screen(`<div class="intro grow">${mark(52)}<h1 class="display">Nothing to approve</h1><p class="lede">This request already finished. You can close this window.</p></div>`);
      return;
    }
    if (payload.kind === "connect") return renderConnectApproval(requestId, payload.request);
    if (payload.kind === "tx") return renderTxApproval(requestId, payload.request);
    return renderMsgApproval(requestId, payload.request);
  }
  function hostOf(origin) {
    try {
      return new URL(origin).hostname;
    } catch {
      return origin;
    }
  }
  var KIND_NAMES = {
    trading: "Trading Alias",
    collecting: "Collecting Alias",
    everyday: "Everyday Alias",
    fresh: "Fresh Alias"
  };
  async function renderConnectApproval(requestId, request) {
    let chosen = request.recommendedAliasId ?? null;
    const newKind = request.recommendedKind ?? "fresh";
    const newName = newKind === "fresh" ? `${hostOf(request.origin)} Alias` : KIND_NAMES[newKind];
    const recommended = aliasList.find((a) => a.id === request.recommendedAliasId);
    const title = recommended ? `Use ${recommended.name} here` : `Use a new ${newKind === "fresh" ? "fresh alias" : KIND_NAMES[newKind]} here`;
    const renderBody = (showAll) => {
      const current = aliasList.find((a) => a.id === chosen);
      screen(`
      ${topbar("Connection request")}
      <div class="stack grow">
        <div class="card site-banner">
          ${siteTile(hostOf(request.origin), 40)}
          <div style="min-width:0">
            <div class="origin">${esc(request.siteLabel ?? hostOf(request.origin))}</div>
            <div class="small muted" style="word-break:break-all">${esc(request.origin)}</div>
          </div>
        </div>
        <div class="hero" style="margin:4px 0 0"><h1 style="font-size:19px">${esc(title)}</h1>
          ${request.recommendedReason ? `<p class="small">${esc(request.recommendedReason)}</p>` : ""}
        </div>
        ${showAll ? `<div class="list" style="max-height:200px">${aliasList.map(
        (a) => `<button class="card list-item${a.id === chosen ? "" : ""}" data-pick="${a.id}" style="text-align:left;${a.id === chosen ? "border-color:var(--lilac);background:var(--lilac-soft)" : ""}">
                    ${avatar(a, 28)}
                    <div class="meta"><div class="one">${esc(a.name)}</div><div class="two">${shortAddress(a.address, 5, 5)}</div></div>
                  </button>`
      ).join("")}
                <button class="card list-item" data-newalias style="text-align:left;${chosen === null ? "border-color:var(--lilac);background:var(--lilac-soft)" : ""}"><div class="meta"><div class="one">\uFF0B ${esc(newName)}</div><div class="two">New, only for this site</div></div></button>
              </div>` : current ? `<div class="card list-item">${avatar(current, 30)}<div class="meta"><div class="one">${esc(current.name)}</div><div class="two mono">${shortAddress(current.address, 6, 6)}</div></div></div>` : `<div class="card list-item">${avatar({ name: newName, avatarSeed: 2, kind: newKind }, 30)}<div class="meta"><div class="one">${esc(newName)}</div><div class="two">New address, created when you approve</div></div></div>`}
        <p class="small muted">The site only sees this alias address. Your main wallet stays separate.</p>
        <div class="error-text"></div>
      </div>
      <div class="bottom">
        <button class="btn btn-primary" id="approve">Use this Alias</button>
        ${showAll ? "" : `<button class="btn btn-ghost" id="choose">Choose another</button>`}
        <button class="btn btn-ghost" id="reject">Cancel</button>
      </div>
    `);
      on("#choose", "click", () => renderBody(true));
      on("[data-pick]", "click", (_e, el) => {
        chosen = el.dataset.pick;
        renderBody(true);
      });
      on("[data-newalias]", "click", () => {
        chosen = null;
        renderBody(false);
      });
      on("#approve", "click", async () => {
        try {
          if (!chosen) {
            const info = await bg({ type: "alias.create", name: newName, kind: newKind });
            chosen = info.id;
          }
          await bg({ type: "approval.resolveConnect", requestId, approved: true, aliasId: chosen });
          window.close();
        } catch (e) {
          showError(e.message);
        }
      });
      on("#reject", "click", async () => {
        await bg({ type: "approval.resolveConnect", requestId, approved: false });
        window.close();
      });
    };
    renderBody(false);
  }
  async function renderTxApproval(requestId, request) {
    const alias = aliasList.find((a) => a.id === request.aliasId);
    const isMainnet = settings.network === "mainnet-beta";
    screen(`
    ${topbar("Approve transaction")}
    <div class="stack grow">
      <div class="card site-banner">${avatar(alias, 32)}
        <div style="min-width:0"><div class="origin">${esc(hostOf(request.origin))}</div>
        <div class="small muted">asks ${esc(alias.name)} to sign${request.mode === "signAndSend" ? " and send" : ""}</div></div>
      </div>
      <div id="sim"><div class="card" style="padding:14px;display:flex;gap:10px;align-items:center"><div class="spin"></div><span class="muted">Checking what this does\u2026</span></div></div>
      <div class="kv"><span class="k">Network</span><span class="v">${isMainnet ? "Mainnet (real funds)" : "Devnet"}</span></div>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="approve" disabled>Approve</button>
      <button class="btn btn-ghost" id="reject">Reject</button>
    </div>
  `);
    on("#reject", "click", async () => {
      await bg({ type: "approval.resolveTx", requestId, approved: false });
      window.close();
    });
    const sim = await bg({ type: "tx.simulate", txBase64: request.txBase64, aliasAddress: alias.address });
    const slot = app.querySelector("#sim");
    const approveBtn = app.querySelector("#approve");
    if (!sim.ok) {
      slot.innerHTML = `
      <div class="notice coral">Could not establish what this transaction does.${esc(sim.error ? ` ${sim.error}` : "")}</div>
      ${isMainnet ? `<p class="small muted" style="margin-top:6px">On mainnet, unverified transactions cannot be approved.</p>` : `<p class="small muted" style="margin-top:6px">Devnet only: you can still approve, with care.</p>`}
      ${sim.logsTail?.length ? `<details class="more"><summary>Details</summary><pre>${esc(sim.logsTail.join("\n"))}</pre></details>` : ""}`;
      if (!isMainnet) approveBtn.disabled = false;
    } else {
      slot.innerHTML = `
      <div class="effects">
        ${sim.effects.length === 0 ? `<div class="notice amber">No balance changes for this alias were found in simulation.</div>` : sim.effects.map((e) => `<div class="effect ${e.uiDelta.startsWith("-") ? "out" : "in"}"><span>${e.uiDelta.startsWith("-") ? "Send" : "Receive"}</span><span class="mono">${esc(e.uiDelta)}</span></div>`).join("")}
      </div>
      <div class="kv" style="margin-top:6px"><span class="k">Network fee (estimate)</span><span class="v mono">${sim.feeLamports !== void 0 ? `${lamportsToSol(sim.feeLamports)} SOL` : "unknown"}</span></div>
      ${sim.writableUnknown ? `<p class="small muted">Some accounts could not be checked; estimates only, not guaranteed settlement.</p>` : `<p class="small muted">Simulation estimate, not guaranteed settlement.</p>`}
      ${sim.logsTail?.length ? `<details class="more"><summary>Details</summary><pre>${esc(sim.logsTail.join("\n"))}</pre></details>` : ""}`;
      approveBtn.disabled = false;
    }
    on("#approve", "click", async () => {
      approveBtn.disabled = true;
      await bg({ type: "approval.resolveTx", requestId, approved: true });
      window.close();
    });
  }
  async function renderMsgApproval(requestId, request) {
    const alias = aliasList.find((a) => a.id === request.aliasId);
    let text = "";
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(request.messageBase64), (c) => c.charCodeAt(0)));
    } catch {
      text = "(binary message)";
    }
    screen(`
    ${topbar("Sign a message")}
    <div class="stack grow">
      <div class="card site-banner">${avatar(alias, 32)}
        <div style="min-width:0"><div class="origin">${esc(hostOf(request.origin))}</div><div class="small muted">asks ${esc(alias.name)} to sign a message</div></div>
      </div>
      <div class="card" style="padding:12px;max-height:200px;overflow:auto;font-size:13px;white-space:pre-wrap;word-break:break-word">${esc(text)}</div>
      <p class="small muted">Signing proves this alias agreed to the text above. It does not move funds.</p>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="approve">Sign</button>
      <button class="btn btn-ghost" id="reject">Reject</button>
    </div>
  `);
    on("#approve", "click", async () => {
      await bg({ type: "approval.resolveMsg", requestId, approved: true });
      window.close();
    });
    on("#reject", "click", async () => {
      await bg({ type: "approval.resolveMsg", requestId, approved: false });
      window.close();
    });
  }
  setInterval(() => {
    if (document.body.classList.contains("windowed")) void bgCall({ type: "ping" });
  }, 2e4);
  void route();
})();
