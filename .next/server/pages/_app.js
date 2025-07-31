/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "(pages-dir-node)/./pages/_app.js":
/*!***********************!*\
  !*** ./pages/_app.js ***!
  \***********************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ App)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../styles/globals.css */ \"(pages-dir-node)/./styles/globals.css\");\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_styles_globals_css__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _privy_io_react_auth__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @privy-io/react-auth */ \"@privy-io/react-auth\");\n/* harmony import */ var wagmi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! wagmi */ \"wagmi\");\n/* harmony import */ var _utils_chains__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/chains */ \"(pages-dir-node)/./utils/chains.js\");\n/* harmony import */ var _tanstack_react_query__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @tanstack/react-query */ \"@tanstack/react-query\");\n/* harmony import */ var viem__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! viem */ \"viem\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_privy_io_react_auth__WEBPACK_IMPORTED_MODULE_2__, wagmi__WEBPACK_IMPORTED_MODULE_3__, _tanstack_react_query__WEBPACK_IMPORTED_MODULE_5__, viem__WEBPACK_IMPORTED_MODULE_6__]);\n([_privy_io_react_auth__WEBPACK_IMPORTED_MODULE_2__, wagmi__WEBPACK_IMPORTED_MODULE_3__, _tanstack_react_query__WEBPACK_IMPORTED_MODULE_5__, viem__WEBPACK_IMPORTED_MODULE_6__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);\n\n\n\n\n\n\n\nconst queryClient = new _tanstack_react_query__WEBPACK_IMPORTED_MODULE_5__.QueryClient();\nconst wagmiConfig = (0,wagmi__WEBPACK_IMPORTED_MODULE_3__.createConfig)({\n    chains: [\n        _utils_chains__WEBPACK_IMPORTED_MODULE_4__.monadTestnet\n    ],\n    transports: {\n        [_utils_chains__WEBPACK_IMPORTED_MODULE_4__.monadTestnet.id]: (0,viem__WEBPACK_IMPORTED_MODULE_6__.http)('https://testnet-rpc.monad.xyz/')\n    }\n});\nfunction App({ Component, pageProps }) {\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_tanstack_react_query__WEBPACK_IMPORTED_MODULE_5__.QueryClientProvider, {\n        client: queryClient,\n        children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(wagmi__WEBPACK_IMPORTED_MODULE_3__.WagmiConfig, {\n            config: wagmiConfig,\n            children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_privy_io_react_auth__WEBPACK_IMPORTED_MODULE_2__.PrivyProvider, {\n                appId: \"cmbbwnqyq000ul20ls0gjhznt\",\n                config: {\n                    embeddedWallets: {\n                        createOnLogin: 'all-users',\n                        requireUserConfirmation: false,\n                        noPromptOnSignature: true,\n                        autoConnect: true\n                    },\n                    supportedChains: [\n                        _utils_chains__WEBPACK_IMPORTED_MODULE_4__.monadTestnet\n                    ],\n                    appearance: {\n                        theme: 'dark',\n                        accentColor: '#6366f1'\n                    },\n                    loginMethods: [\n                        'email',\n                        'wallet'\n                    ],\n                    defaultWallet: 'embedded'\n                },\n                children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n                    ...pageProps\n                }, void 0, false, {\n                    fileName: \"C:\\\\Users\\\\chand\\\\Downloads\\\\johnwrichkidintorizz\\\\pages\\\\_app.js\",\n                    lineNumber: 39,\n                    columnNumber: 11\n                }, this)\n            }, void 0, false, {\n                fileName: \"C:\\\\Users\\\\chand\\\\Downloads\\\\johnwrichkidintorizz\\\\pages\\\\_app.js\",\n                lineNumber: 21,\n                columnNumber: 9\n            }, this)\n        }, void 0, false, {\n            fileName: \"C:\\\\Users\\\\chand\\\\Downloads\\\\johnwrichkidintorizz\\\\pages\\\\_app.js\",\n            lineNumber: 20,\n            columnNumber: 7\n        }, this)\n    }, void 0, false, {\n        fileName: \"C:\\\\Users\\\\chand\\\\Downloads\\\\johnwrichkidintorizz\\\\pages\\\\_app.js\",\n        lineNumber: 19,\n        columnNumber: 5\n    }, this);\n}\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHBhZ2VzLWRpci1ub2RlKS8uL3BhZ2VzL19hcHAuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBK0I7QUFDc0I7QUFDSDtBQUNIO0FBQzBCO0FBQzdDO0FBRTVCLE1BQU1PLGNBQWMsSUFBSUgsOERBQVdBO0FBRW5DLE1BQU1JLGNBQWNOLG1EQUFZQSxDQUFDO0lBQy9CTyxRQUFRO1FBQUNOLHVEQUFZQTtLQUFDO0lBQ3RCTyxZQUFZO1FBQ1YsQ0FBQ1AsdURBQVlBLENBQUNRLEVBQUUsQ0FBQyxFQUFFTCwwQ0FBSUEsQ0FBQztJQUMxQjtBQUNGO0FBRWUsU0FBU00sSUFBSSxFQUFFQyxTQUFTLEVBQUVDLFNBQVMsRUFBRTtJQUNsRCxxQkFDRSw4REFBQ1Qsc0VBQW1CQTtRQUFDVSxRQUFRUjtrQkFDM0IsNEVBQUNOLDhDQUFXQTtZQUFDZSxRQUFRUjtzQkFDbkIsNEVBQUNSLCtEQUFhQTtnQkFDWmlCLE9BQU9DLDJCQUFvQztnQkFDM0NGLFFBQVE7b0JBQ05LLGlCQUFpQjt3QkFDZkMsZUFBZTt3QkFDZkMseUJBQXlCO3dCQUN6QkMscUJBQXFCO3dCQUNyQkMsYUFBYTtvQkFDZjtvQkFDQUMsaUJBQWlCO3dCQUFDdkIsdURBQVlBO3FCQUFDO29CQUMvQndCLFlBQVk7d0JBQ1ZDLE9BQU87d0JBQ1BDLGFBQWE7b0JBQ2Y7b0JBQ0FDLGNBQWM7d0JBQUM7d0JBQVM7cUJBQVM7b0JBQ2pDQyxlQUFlO2dCQUNqQjswQkFFQSw0RUFBQ2xCO29CQUFXLEdBQUdDLFNBQVM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUtsQyIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxjaGFuZFxcRG93bmxvYWRzXFxqb2hud3JpY2hraWRpbnRvcml6elxccGFnZXNcXF9hcHAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICcuLi9zdHlsZXMvZ2xvYmFscy5jc3MnO1xuaW1wb3J0IHsgUHJpdnlQcm92aWRlciB9IGZyb20gJ0Bwcml2eS1pby9yZWFjdC1hdXRoJztcbmltcG9ydCB7IFdhZ21pQ29uZmlnLCBjcmVhdGVDb25maWcgfSBmcm9tICd3YWdtaSc7XG5pbXBvcnQgeyBtb25hZFRlc3RuZXQgfSBmcm9tICcuLi91dGlscy9jaGFpbnMnO1xuaW1wb3J0IHsgUXVlcnlDbGllbnQsIFF1ZXJ5Q2xpZW50UHJvdmlkZXIgfSBmcm9tICdAdGFuc3RhY2svcmVhY3QtcXVlcnknO1xuaW1wb3J0IHsgaHR0cCB9IGZyb20gJ3ZpZW0nO1xuXG5jb25zdCBxdWVyeUNsaWVudCA9IG5ldyBRdWVyeUNsaWVudCgpO1xuXG5jb25zdCB3YWdtaUNvbmZpZyA9IGNyZWF0ZUNvbmZpZyh7XG4gIGNoYWluczogW21vbmFkVGVzdG5ldF0sXG4gIHRyYW5zcG9ydHM6IHtcbiAgICBbbW9uYWRUZXN0bmV0LmlkXTogaHR0cCgnaHR0cHM6Ly90ZXN0bmV0LXJwYy5tb25hZC54eXovJyksXG4gIH0sXG59KTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gQXBwKHsgQ29tcG9uZW50LCBwYWdlUHJvcHMgfSkge1xuICByZXR1cm4gKFxuICAgIDxRdWVyeUNsaWVudFByb3ZpZGVyIGNsaWVudD17cXVlcnlDbGllbnR9PlxuICAgICAgPFdhZ21pQ29uZmlnIGNvbmZpZz17d2FnbWlDb25maWd9PlxuICAgICAgICA8UHJpdnlQcm92aWRlclxuICAgICAgICAgIGFwcElkPXtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19QUklWWV9BUFBfSUR9XG4gICAgICAgICAgY29uZmlnPXt7XG4gICAgICAgICAgICBlbWJlZGRlZFdhbGxldHM6IHtcbiAgICAgICAgICAgICAgY3JlYXRlT25Mb2dpbjogJ2FsbC11c2VycycsXG4gICAgICAgICAgICAgIHJlcXVpcmVVc2VyQ29uZmlybWF0aW9uOiBmYWxzZSxcbiAgICAgICAgICAgICAgbm9Qcm9tcHRPblNpZ25hdHVyZTogdHJ1ZSxcbiAgICAgICAgICAgICAgYXV0b0Nvbm5lY3Q6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3VwcG9ydGVkQ2hhaW5zOiBbbW9uYWRUZXN0bmV0XSxcbiAgICAgICAgICAgIGFwcGVhcmFuY2U6IHtcbiAgICAgICAgICAgICAgdGhlbWU6ICdkYXJrJyxcbiAgICAgICAgICAgICAgYWNjZW50Q29sb3I6ICcjNjM2NmYxJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsb2dpbk1ldGhvZHM6IFsnZW1haWwnLCAnd2FsbGV0J10sXG4gICAgICAgICAgICBkZWZhdWx0V2FsbGV0OiAnZW1iZWRkZWQnLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICA8Q29tcG9uZW50IHsuLi5wYWdlUHJvcHN9IC8+XG4gICAgICAgIDwvUHJpdnlQcm92aWRlcj5cbiAgICAgIDwvV2FnbWlDb25maWc+XG4gICAgPC9RdWVyeUNsaWVudFByb3ZpZGVyPlxuICApO1xufSAiXSwibmFtZXMiOlsiUHJpdnlQcm92aWRlciIsIldhZ21pQ29uZmlnIiwiY3JlYXRlQ29uZmlnIiwibW9uYWRUZXN0bmV0IiwiUXVlcnlDbGllbnQiLCJRdWVyeUNsaWVudFByb3ZpZGVyIiwiaHR0cCIsInF1ZXJ5Q2xpZW50Iiwid2FnbWlDb25maWciLCJjaGFpbnMiLCJ0cmFuc3BvcnRzIiwiaWQiLCJBcHAiLCJDb21wb25lbnQiLCJwYWdlUHJvcHMiLCJjbGllbnQiLCJjb25maWciLCJhcHBJZCIsInByb2Nlc3MiLCJlbnYiLCJORVhUX1BVQkxJQ19QUklWWV9BUFBfSUQiLCJlbWJlZGRlZFdhbGxldHMiLCJjcmVhdGVPbkxvZ2luIiwicmVxdWlyZVVzZXJDb25maXJtYXRpb24iLCJub1Byb21wdE9uU2lnbmF0dXJlIiwiYXV0b0Nvbm5lY3QiLCJzdXBwb3J0ZWRDaGFpbnMiLCJhcHBlYXJhbmNlIiwidGhlbWUiLCJhY2NlbnRDb2xvciIsImxvZ2luTWV0aG9kcyIsImRlZmF1bHRXYWxsZXQiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(pages-dir-node)/./pages/_app.js\n");

/***/ }),

/***/ "(pages-dir-node)/./styles/globals.css":
/*!****************************!*\
  !*** ./styles/globals.css ***!
  \****************************/
/***/ (() => {



/***/ }),

/***/ "(pages-dir-node)/./utils/chains.js":
/*!*************************!*\
  !*** ./utils/chains.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   monadTestnet: () => (/* binding */ monadTestnet)\n/* harmony export */ });\n// utils/chains.js\nconst monadTestnet = {\n    id: 10143,\n    name: 'Monad Testnet',\n    network: 'monad-testnet',\n    nativeCurrency: {\n        name: 'MON',\n        symbol: 'MON',\n        decimals: 18\n    },\n    rpcUrls: {\n        default: {\n            http: [\n                'https://testnet-rpc.monad.xyz/'\n            ]\n        },\n        public: {\n            http: [\n                'https://testnet-rpc.monad.xyz/'\n            ]\n        }\n    },\n    blockExplorers: {\n        default: {\n            name: 'Monad Explorer',\n            url: 'https://testnet.monadexplorer.com/'\n        }\n    },\n    testnet: true,\n    contracts: {\n        multicall3: {\n            address: '0xca11bde05977b3631167028862be2a173976ca11',\n            blockCreated: 1\n        }\n    }\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHBhZ2VzLWRpci1ub2RlKS8uL3V0aWxzL2NoYWlucy5qcyIsIm1hcHBpbmdzIjoiOzs7O0FBQUEsa0JBQWtCO0FBQ1gsTUFBTUEsZUFBZTtJQUN4QkMsSUFBSTtJQUNKQyxNQUFNO0lBQ05DLFNBQVM7SUFDVEMsZ0JBQWdCO1FBQUVGLE1BQU07UUFBT0csUUFBUTtRQUFPQyxVQUFVO0lBQUc7SUFDM0RDLFNBQVM7UUFDUEMsU0FBUztZQUFFQyxNQUFNO2dCQUFDO2FBQWlDO1FBQUM7UUFDcERDLFFBQVE7WUFBRUQsTUFBTTtnQkFBQzthQUFpQztRQUFDO0lBQ3JEO0lBQ0FFLGdCQUFnQjtRQUNkSCxTQUFTO1lBQUVOLE1BQU07WUFBa0JVLEtBQUs7UUFBcUM7SUFDL0U7SUFDQUMsU0FBUztJQUNUQyxXQUFXO1FBQ1RDLFlBQVk7WUFDVkMsU0FBUztZQUNUQyxjQUFjO1FBQ2hCO0lBQ0Y7QUFDRixFQUFFIiwic291cmNlcyI6WyJDOlxcVXNlcnNcXGNoYW5kXFxEb3dubG9hZHNcXGpvaG53cmljaGtpZGludG9yaXp6XFx1dGlsc1xcY2hhaW5zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHV0aWxzL2NoYWlucy5qc1xyXG5leHBvcnQgY29uc3QgbW9uYWRUZXN0bmV0ID0ge1xyXG4gICAgaWQ6IDEwMTQzLFxyXG4gICAgbmFtZTogJ01vbmFkIFRlc3RuZXQnLFxyXG4gICAgbmV0d29yazogJ21vbmFkLXRlc3RuZXQnLFxyXG4gICAgbmF0aXZlQ3VycmVuY3k6IHsgbmFtZTogJ01PTicsIHN5bWJvbDogJ01PTicsIGRlY2ltYWxzOiAxOCB9LFxyXG4gICAgcnBjVXJsczoge1xyXG4gICAgICBkZWZhdWx0OiB7IGh0dHA6IFsnaHR0cHM6Ly90ZXN0bmV0LXJwYy5tb25hZC54eXovJ10gfSxcclxuICAgICAgcHVibGljOiB7IGh0dHA6IFsnaHR0cHM6Ly90ZXN0bmV0LXJwYy5tb25hZC54eXovJ10gfSxcclxuICAgIH0sXHJcbiAgICBibG9ja0V4cGxvcmVyczoge1xyXG4gICAgICBkZWZhdWx0OiB7IG5hbWU6ICdNb25hZCBFeHBsb3JlcicsIHVybDogJ2h0dHBzOi8vdGVzdG5ldC5tb25hZGV4cGxvcmVyLmNvbS8nIH0sXHJcbiAgICB9LFxyXG4gICAgdGVzdG5ldDogdHJ1ZSxcclxuICAgIGNvbnRyYWN0czoge1xyXG4gICAgICBtdWx0aWNhbGwzOiB7XHJcbiAgICAgICAgYWRkcmVzczogJzB4Y2ExMWJkZTA1OTc3YjM2MzExNjcwMjg4NjJiZTJhMTczOTc2Y2ExMScsXHJcbiAgICAgICAgYmxvY2tDcmVhdGVkOiAxLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9OyJdLCJuYW1lcyI6WyJtb25hZFRlc3RuZXQiLCJpZCIsIm5hbWUiLCJuZXR3b3JrIiwibmF0aXZlQ3VycmVuY3kiLCJzeW1ib2wiLCJkZWNpbWFscyIsInJwY1VybHMiLCJkZWZhdWx0IiwiaHR0cCIsInB1YmxpYyIsImJsb2NrRXhwbG9yZXJzIiwidXJsIiwidGVzdG5ldCIsImNvbnRyYWN0cyIsIm11bHRpY2FsbDMiLCJhZGRyZXNzIiwiYmxvY2tDcmVhdGVkIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(pages-dir-node)/./utils/chains.js\n");

/***/ }),

/***/ "@privy-io/react-auth":
/*!***************************************!*\
  !*** external "@privy-io/react-auth" ***!
  \***************************************/
/***/ ((module) => {

"use strict";
module.exports = import("@privy-io/react-auth");;

/***/ }),

/***/ "@tanstack/react-query":
/*!****************************************!*\
  !*** external "@tanstack/react-query" ***!
  \****************************************/
/***/ ((module) => {

"use strict";
module.exports = import("@tanstack/react-query");;

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "viem":
/*!***********************!*\
  !*** external "viem" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = import("viem");;

/***/ }),

/***/ "wagmi":
/*!************************!*\
  !*** external "wagmi" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = import("wagmi");;

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("(pages-dir-node)/./pages/_app.js"));
module.exports = __webpack_exports__;

})();