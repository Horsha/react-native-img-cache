"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var react_1 = require("react");
var react_native_1 = require("react-native");
var rn_fetch_blob_1 = require("rn-fetch-blob");
var SHA1 = require("crypto-js/sha1");
var s4 = function () { return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1); };
var BASE_DIR = rn_fetch_blob_1["default"].fs.dirs.CacheDir + "/react-native-img-cache";
var FILE_PREFIX = react_native_1.Platform.OS === "ios" ? "" : "file://";
var ImageCache = /** @class */ (function () {
    function ImageCache() {
        this.cache = {};
    }
    ImageCache.prototype.getPath = function (uri, immutable) {
        var path = uri.substring(uri.lastIndexOf("/"));
        path = path.indexOf("?") === -1 ? path : path.substring(path.lastIndexOf("."), path.indexOf("?"));
        var ext = path.indexOf(".") === -1 ? ".jpg" : path.substring(path.indexOf("."));
        if (immutable === true) {
            return BASE_DIR + "/" + SHA1(uri) + ext;
        }
        else {
            return BASE_DIR + "/" + s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4() + ext;
        }
    };
    ImageCache.get = function () {
        if (!ImageCache.instance) {
            ImageCache.instance = new ImageCache();
        }
        return ImageCache.instance;
    };
    ImageCache.prototype.clear = function () {
        this.cache = {};
        return rn_fetch_blob_1["default"].fs.unlink(BASE_DIR);
    };
    ImageCache.prototype.on = function (source, handler, immutable) {
        var uri = source.uri;
        if (!this.cache[uri]) {
            this.cache[uri] = {
                source: source,
                downloading: false,
                handlers: [handler],
                immutable: immutable === true,
                path: immutable === true ? this.getPath(uri, immutable) : undefined
            };
        }
        else {
            this.cache[uri].handlers.push(handler);
        }
        this.get(uri);
    };
    ImageCache.prototype.dispose = function (uri, handler) {
        var cache = this.cache[uri];
        if (cache) {
            cache.handlers.forEach(function (h, index) {
                if (h === handler) {
                    cache.handlers.splice(index, 1);
                }
            });
        }
    };
    ImageCache.prototype.bust = function (uri) {
        var cache = this.cache[uri];
        if (cache !== undefined && !cache.immutable) {
            cache.path = undefined;
            this.get(uri);
        }
    };
    ImageCache.prototype.cancel = function (uri) {
        var cache = this.cache[uri];
        if (cache && cache.downloading) {
            cache.task.cancel();
        }
    };
    ImageCache.prototype.download = function (cache) {
        var _this = this;
        var source = cache.source;
        var uri = source.uri;
        if (!cache.downloading) {
            var path_1 = this.getPath(uri, cache.immutable);
            cache.downloading = true;
            var method = source.method ? source.method : "GET";
            cache.task = rn_fetch_blob_1["default"].config({ path: path_1 }).fetch(method, uri, source.headers);
            cache.task.then(function () {
                cache.downloading = false;
                cache.path = path_1;
                _this.notify(uri);
            })["catch"](function () {
                cache.downloading = false;
                // Parts of the image may have been downloaded already, (see https://github.com/wkh237/react-native-fetch-blob/issues/331)
                rn_fetch_blob_1["default"].fs.unlink(path_1);
            });
        }
    };
    ImageCache.prototype.get = function (uri) {
        var _this = this;
        var cache = this.cache[uri];
        if (cache.path) {
            // We check here if IOS didn't delete the cache content
            rn_fetch_blob_1["default"].fs.exists(cache.path).then(function (exists) {
                if (exists) {
                    _this.notify(uri);
                }
                else {
                    _this.download(cache);
                }
            });
        }
        else {
            this.download(cache);
        }
    };
    ImageCache.prototype.notify = function (uri) {
        var _this = this;
        var handlers = this.cache[uri].handlers;
        handlers.forEach(function (handler) {
            handler(_this.cache[uri].path);
        });
    };
    return ImageCache;
}());
exports.ImageCache = ImageCache;
var BaseCachedImage = /** @class */ (function (_super) {
    __extends(BaseCachedImage, _super);
    function BaseCachedImage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.handler = function (path) {
            _this.setState({ path: path });
        };
        return _this;
    }
    BaseCachedImage.prototype.dispose = function () {
        if (this.uri) {
            ImageCache.get().dispose(this.uri, this.handler);
        }
    };
    BaseCachedImage.prototype.observe = function (source, mutable) {
        if (source.uri !== this.uri) {
            this.dispose();
            this.uri = source.uri;
            ImageCache.get().on(source, this.handler, !mutable);
        }
    };
    BaseCachedImage.prototype.getProps = function () {
        var _this = this;
        var props = {};
        Object.keys(this.props).forEach(function (prop) {
            if (prop === "source" && _this.props.source.uri) {
                props["source"] = _this.state.path ? { uri: FILE_PREFIX + _this.state.path } : {};
            }
            else if (["mutable", "component"].indexOf(prop) === -1) {
                props[prop] = _this.props[prop];
            }
        });
        return props;
    };
    BaseCachedImage.prototype.checkSource = function (source) {
        if (Array.isArray(source)) {
            throw new Error("Giving multiple URIs to CachedImage is not yet supported.\n            If you want to see this feature supported, please file and issue at\n             https://github.com/wcandillon/react-native-img-cache");
        }
        return source;
    };
    BaseCachedImage.prototype.componentWillMount = function () {
        var mutable = this.props.mutable;
        var source = this.checkSource(this.props.source);
        this.setState({ path: undefined });
        if (typeof (source) !== "number" && source.uri) {
            this.observe(source, mutable === true);
        }
    };
    BaseCachedImage.prototype.componentWillReceiveProps = function (nextProps) {
        var mutable = nextProps.mutable;
        var source = this.checkSource(nextProps.source);
        if (typeof (source) !== "number" && source.uri) {
            this.observe(source, mutable === true);
        }
    };
    BaseCachedImage.prototype.componentWillUnmount = function () {
        this.dispose();
    };
    return BaseCachedImage;
}(react_1.Component));
exports.BaseCachedImage = BaseCachedImage;
var CachedImage = /** @class */ (function (_super) {
    __extends(CachedImage, _super);
    function CachedImage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CachedImage.prototype.render = function () {
        var props = this.getProps();
        if (react_1["default"].Children.count(this.props.children) > 0) {
            console.warn("Using <CachedImage> with children is deprecated, use <CachedImageBackground> instead.");
        }
        return react_1["default"].createElement(react_native_1.Image, __assign({}, props), this.props.children);
    };
    return CachedImage;
}(BaseCachedImage));
exports.CachedImage = CachedImage;
var CachedImageBackground = /** @class */ (function (_super) {
    __extends(CachedImageBackground, _super);
    function CachedImageBackground() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CachedImageBackground.prototype.render = function () {
        var props = this.getProps();
        return react_1["default"].createElement(react_native_1.ImageBackground, __assign({}, props), this.props.children);
    };
    return CachedImageBackground;
}(BaseCachedImage));
exports.CachedImageBackground = CachedImageBackground;
var CustomCachedImage = /** @class */ (function (_super) {
    __extends(CustomCachedImage, _super);
    function CustomCachedImage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CustomCachedImage.prototype.render = function () {
        var component = this.props.component;
        var props = this.getProps();
        var Component = component;
        return react_1["default"].createElement(Component, __assign({}, props), this.props.children);
    };
    return CustomCachedImage;
}(BaseCachedImage));
exports.CustomCachedImage = CustomCachedImage;
//# sourceMappingURL=index.js.map