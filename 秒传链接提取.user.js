'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

// ==UserScript==
// @name              秒传链接提取
// @namespace         moe.cangku.mengzonefire
// @version           1.4.5
// @description       用于提取和生成百度网盘秒传链接
// @author            mengzonefire
// @match             *://pan.baidu.com/disk/home*
// @match             *://yun.baidu.com/disk/home*
// @require           https://cdn.jsdelivr.net/npm/sweetalert2@8
// @require           https://cdn.jsdelivr.net/npm/js-base64
// @require           https://cdn.staticfile.org/spark-md5/3.0.0/spark-md5.min.js
// @grant             GM_setValue
// @grant             GM_getValue
// @grant             GM_deleteValue
// @grant             GM_setClipboard
// @grant             GM_xmlhttpRequest
// @grant             GM_info
// @run-at            document-body
// @connect           *
// ==/UserScript==
!function () {
    'use strict';

    var api_url = 'http://pan.baidu.com/rest/2.0/xpan/multimedia?method=listall&order=name&limit=10000';
    var pcs_url = 'https://pcs.baidu.com/rest/2.0/pcs/file';
    var appid_list = ['266719', '265486', '250528', '778750', '498065', '309847'];
    //使用'250528', '265486', '266719'，下载50M以上的文件会报403，黑号情况下部分文件也会报403
    var bad_md5 = ['fcadf26fc508b8039bee8f0901d9c58e', '2d9a55b7d5fe70e74ce8c3b2be8f8e43', 'b912d5b77babf959865100bf1d0c2a19'];
    var select_list,
        failed = 0,
        check_mode = false,
        file_info_list = [],
        gen_success_list = [],
        dir,
        file_num,
        gen_num,
        gen_prog,
        list_path,
        codeInfo,
        recursive,
        bdcode,
        xmlhttpRequest;
    var myStyle = 'style="width: 100%;height: 34px;display: block;line-height: 34px;text-align: center;"';
    var myBtnStyle = 'style="height: 26px;line-height: 26px;vertical-align: middle;"';
    var html_btn = '<a class="g-button g-button-blue href="javascript:;" id="bdlink_btn" title="\u79D2\u4F20\u94FE\u63A5" style="display: inline-block;"">\n    <span class="g-button-right"><em class="icon icon-disk" title="\u79D2\u4F20\u94FE\u63A5\u63D0\u53D6"></em><span class="text" style="width: auto;">\u79D2\u4F20\u94FE\u63A5</span></span></a>';
    var html_btn_gen = '<a class="g-button gen-bdlink-button"><span class="g-button-right"><em class="icon icon-share" title="\u751F\u6210\u79D2\u4F20">\n    </em><span class="text">\u751F\u6210\u79D2\u4F20</span></span></a>';
    var html_check_md5 = '<p ' + myStyle + '>\u6D4B\u8BD5\u79D2\u4F20, \u53EF\u9632\u6B62\u79D2\u4F20\u5931\u6548\n    <a class="g-button g-button-blue" id="check_md5_btn"><span class="g-button-right"><span class="text" style="width: auto;">\u6D4B\u8BD5</span>\n    </span></a></p><p>\u6CE8\u610F: \u6D4B\u8BD5\u79D2\u4F20\u4F1A\u8F6C\u5B58\u5E76\u8986\u76D6\u6587\u4EF6,\u82E5\u5728\u751F\u6210\u671F\u95F4\u4FEE\u6539\u8FC7\u540C\u540D\u6587\u4EF6,\u4E3A\u907F\u514D\u4FEE\u6539\u7684\u6587\u4EF6\u4E22\u5931,\u8BF7\u4E0D\u8981\u4F7F\u7528\u6B64\u529F\u80FD!</p>';
    var html_donate = '<p id="bdcode_donate" ' + myStyle + '>\u82E5\u559C\u6B22\u8BE5\u811A\u672C, \u53EF\u524D\u5F80 <a href="https://afdian.net/@mengzonefire" rel="noopener noreferrer" target="_blank">\u8D5E\u52A9\u9875</a> \u652F\u6301\u4F5C\u8005\n    <a class="g-button" id="kill_donate" ' + myBtnStyle + '><span class="g-button-right" ' + myBtnStyle + '><span class="text" style="width: auto;">\u4E0D\u518D\u663E\u793A</span></span></a></p>';
    var html_feedback = '<p id="bdcode_feedback" ' + myStyle + '>\u82E5\u811A\u672C\u4F7F\u7528\u6709\u4EFB\u4F55\u95EE\u9898, \u53EF\u524D\u5F80 <a href="https://greasyfork.org/zh-CN/scripts/397324" rel="noopener noreferrer" target="_blank">\u811A\u672C\u9875</a> \u53CD\u9988\n    <a class="g-button" id="kill_feedback" ' + myBtnStyle + '><span class="g-button-right" ' + myBtnStyle + '><span class="text" style="width: auto;">\u4E0D\u518D\u663E\u793A</span></span></a></p>';
    var checkbox_par = {
        input: 'checkbox',
        inputValue: GM_getValue('with_path'),
        inputPlaceholder: '导出文件夹目录结构'
    };

    if (Base64.extendString) {
        Base64.extendString();
    }

    function add_file_list(file_list) {
        var dir_list = [];
        file_list.forEach(function (item) {
            if (item.isdir) {
                dir_list.push(item.path);
            } else {
                file_info_list.push({
                    'path': item.path,
                    'size': item.size
                });
            }
        });
        if (dir_list.length) {
            Swal.fire({
                type: 'info',
                title: '选择中包含文件夹, 是否递归生成?',
                text: '若选是，将同时生成各级子文件夹下的文件',
                allowOutsideClick: false,
                focusCancel: true,
                showCancelButton: true,
                reverseButtons: true,
                showCloseButton: true,
                confirmButtonText: '是',
                cancelButtonText: '否'
            }).then(function (result) {
                if (result.value) {
                    recursive = true;
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    recursive = false;
                } else {
                    return;
                }
                add_dir_list(dir_list);
            });
        } else {
            Gen_bdlink();
        }
    }

    function add_dir_list(dir_list) {
        var dir_id = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

        if (dir_id >= dir_list.length) {
            Gen_bdlink();
            return;
        }
        var path = dir_list[dir_id];
        var list_dir_par = {
            url: api_url + ('&path=' + encodeURIComponent(path) + '&recursion=' + (recursive ? 1 : 0)),
            type: 'GET',
            responseType: 'json',
            onload: function onload(r) {
                if (!r.response.errno) {
                    r.response.list.forEach(function (item) {
                        item.isdir || file_info_list.push({
                            'path': item.path,
                            'size': item.size
                        });
                    });
                } else {
                    file_info_list.push({
                        'path': path,
                        'errno': 810
                    });
                }
                add_dir_list(dir_list, dir_id + 1);
            },
            onerror: function onerror(r) {
                file_info_list.push({
                    'path': path,
                    'errno': 514
                });
                add_dir_list(dir_list, dir_id + 1);
            }
        };
        GM_xmlhttpRequest(list_dir_par);
    }

    function initButtonEvent() {
        $(document).on("click", ".gen-bdlink-button", function () {
            if (!GM_getValue('gen_no_first_1.3.3')) {
                Swal.fire({
                    title: '首次使用请注意',
                    showCloseButton: true,
                    allowOutsideClick: false,
                    html: '<p>弹出跨域访问窗口时,请选择"总是允许"或"总是允许全部域名"</p><img style="max-width: 100%; height: auto" src="https://pic.rmb.bdstatic.com/bjh/763ff5014cca49237cb3ede92b5b7ac5.png">'
                }).then(function (result) {
                    if (result.value) {
                        GM_setValue('gen_no_first_1.3.3', true);
                        select_list = getSelectedFileList();
                        add_file_list(select_list);
                    }
                });
                return;
            }
            if (GM_getValue('unfinish')) {
                Swal.fire({
                    title: '检测到未完成的秒传任务',
                    text: '是否继续进行？',
                    showCancelButton: true,
                    allowOutsideClick: false,
                    confirmButtonText: '确定',
                    cancelButtonText: '取消'
                }).then(function (result) {
                    if (result.value) {
                        var unfinish_info = GM_getValue('unfinish');
                        file_info_list = unfinish_info.file_info_list;
                        Gen_bdlink(unfinish_info.file_id);
                    } else {
                        GM_deleteValue('unfinish');
                        select_list = getSelectedFileList();
                        add_file_list(select_list);
                    }
                });
            } else {
                select_list = getSelectedFileList();
                add_file_list(select_list);
            }
        });
    }

    function getSelectedFileList() {
        return unsafeWindow.require('system-core:context/context.js').instanceForSystem.list.getSelected();
    };

    function initButtonHome() {
        var loop = setInterval(function () {
            var html_tag = $("div.tcuLAu");
            if (!html_tag.length) return false;
            html_tag.append(html_btn);
            var loop2 = setInterval(function () {
                var btn_tag = $("#bdlink_btn");
                if (!btn_tag.length) return false;
                btn_tag.click(function () {
                    GetInfo();
                });
                clearInterval(loop2);
            }, 50);
            clearInterval(loop);
        }, 500);
    }

    function initButtonGen() {
        var listTools = getSystemContext().Broker.getButtonBroker("listTools");
        if (listTools && listTools.$box) {
            $(listTools.$box).children('div').after(html_btn_gen);
            initButtonEvent();
        } else {
            setTimeout(initButtonGen, 500);
        }
    };

    function getSystemContext() {
        return unsafeWindow.require("system-core:context/context.js").instanceForSystem;
    };

    function Gen_bdlink() {
        var file_id = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

        Swal.fire({
            title: '秒传生成中',
            showCloseButton: true,
            allowOutsideClick: false,
            html: '<p>正在生成第 <gen_num></gen_num> 个</p><p><gen_prog></gen_prog></p>',
            onBeforeOpen: function onBeforeOpen() {
                Swal.showLoading();
                var content = Swal.getContent();
                if (content) {
                    gen_num = content.querySelector('gen_num');
                    gen_prog = content.querySelector('gen_prog');
                    myGenerater(file_id);
                }
            }
        }).then(function (result) {
            if (result.dismiss && xmlhttpRequest) {
                xmlhttpRequest.abort();
                GM_deleteValue('unfinish');
                file_info_list = [];
            }
        });
    }

    var show_prog = function show_prog(r) {
        gen_prog.textContent = parseInt(r.loaded / r.total * 100) + '%';
    };

    function myGenerater(file_id) {
        var appid_id = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
        var failed = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        GM_setValue('unfinish', {
            'file_info_list': file_info_list,
            'file_id': file_id
        });
        if (file_id >= file_info_list.length) {
            bdcode = '';
            var failed_info = '';
            var gen_failed = 0;
            file_info_list.forEach(function (item) {
                if (item.hasOwnProperty('errno')) {
                    gen_failed++;
                    failed_info += '<p>\u6587\u4EF6\uFF1A' + item.path + '</p><p>\u5931\u8D25\u539F\u56E0\uFF1A' + checkErrno(item.errno, item.size) + '(#' + item.errno + ')</p>';
                } else {
                    gen_success_list.push(item);
                    bdcode += item.md5 + '#' + item.md5s + '#' + item.size + '#' + item.path + '\n';
                }
            });
            bdcode = bdcode.trim();
            if (failed_info) {
                failed_info = '<p>失败文件列表:</p>' + failed_info;
            }
            Swal.fire(_extends({
                title: '\u751F\u6210\u5B8C\u6BD5 \u5171' + file_info_list.length + '\u4E2A, \u5931\u8D25' + gen_failed + '\u4E2A!',
                confirmButtonText: '复制秒传代码',
                cancelButtonText: '取消',
                showCloseButton: true,
                showCancelButton: !bdcode,
                showConfirmButton: bdcode,
                allowOutsideClick: false,
                html: bdcode ? html_check_md5 + (failed_info && '<p><br></p>' + failed_info) : failed_info
            }, bdcode && checkbox_par, {
                onBeforeOpen: function onBeforeOpen() {
                    var loop = setInterval(function () {
                        var html_tag = $("#check_md5_btn");
                        if (!html_tag.length) return false;
                        $("#check_md5_btn").click(function () {
                            codeInfo = gen_success_list;
                            check_mode = true;
                            Process();
                        });
                        clearInterval(loop);
                    }, 50);
                    var content = Swal.getContent();
                    Add_content(content);
                }
            })).then(function (result) {
                if (!result.dismiss) {
                    if (!result.value) {
                        bdcode = bdcode.replace(/(\/.+\/)|(\/)/g, '');
                    }
                    checkbox_par.inputValue = result.value;
                    GM_setValue('with_path', result.value);
                    GM_setClipboard(bdcode);
                }
                file_info_list = [];
                gen_success_list = [];
                GM_deleteValue('unfinish');
            });
            return;
        }
        var file_info = file_info_list[file_id];
        if (file_info.hasOwnProperty('errno')) {
            myGenerater(file_id + 1);
            return;
        }
        if (file_info.size > 21474836480) {
            file_info.errno = 3939;
            myGenerater(file_id + 1);
            return;
        }
        var path = file_info.path;
        gen_num.textContent = (file_id + 1).toString() + ' / ' + file_info_list.length.toString();
        gen_prog.textContent = "0%";

        var dl_size = file_info.size < 262144 ? file_info.size - 1 : 262143;
        if (!failed) {
            appid_id = file_info.size < 50000000 ? 0 : 3;
        }

        var get_dl_par = {
            url: pcs_url + ('?app_id=' + appid_list[appid_id] + '&method=download&path=' + encodeURIComponent(path)),
            type: 'GET',
            headers: {
                'Range': 'bytes=0-' + dl_size
            },
            responseType: 'arraybuffer',
            onprogress: show_prog,
            ontimeout: function ontimeout(r) {
                myGenerater(file_id);
                console.log("timeout !!!");
            },
            onerror: function onerror(r) {
                file_info.errno = 514;
                myGenerater(file_id + 1);
            },
            onload: function onload(r) {
                if (parseInt(r.status / 100) === 2) {
                    var responseHeaders = r.responseHeaders;
                    var file_md5 = responseHeaders.match(/content-md5: ([\da-f]{32})/);
                    if (file_md5) {
                        file_md5 = file_md5[1];
                    } else {
                        file_info.errno = 996;
                        myGenerater(file_id + 1);
                        return;
                    }
                    //bad_md5内的两个md5是和谐文件返回的，第一个是txt格式的"温馨提示.txt"，第二个是视频格式的（俗称5s）,第三个为新发现的8s视频文件
                    if (bad_md5.indexOf(file_md5) !== -1) {
                        file_info.errno = 1919;
                    } else {
                        var spark = new SparkMD5.ArrayBuffer();
                        spark.append(r.response);
                        var slice_md5 = spark.end();
                        file_info.md5 = file_md5;
                        file_info.md5s = slice_md5;
                        sleep(1000);
                    }
                    myGenerater(file_id + 1);
                } else {
                    console.log('use appid: ' + appid_list[appid_id]);
                    if (r.status == 403 && appid_id < appid_list.length - 1) {
                        myGenerater(file_id, appid_id + 1, true);
                    } else {
                        file_info.errno = r.status;
                        myGenerater(file_id + 1);
                    }
                }
            }
        };
        xmlhttpRequest = GM_xmlhttpRequest(get_dl_par);
    };

    /**
     * 一个简单的类似于 NodeJS Buffer 的实现.
     * 用于解析游侠度娘提取码。
     * @param {SimpleBuffer}
     */
    function SimpleBuffer(str) {
        this.fromString(str);
    }
    SimpleBuffer.toStdHex = function toStdHex(n) {
        return ('0' + n.toString(16)).slice(-2);
    };
    SimpleBuffer.prototype.fromString = function fromString(str) {
        var len = str.length;
        this.buf = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
            this.buf[i] = str.charCodeAt(i);
        }
    };
    SimpleBuffer.prototype.readUnicode = function readUnicode(index, size) {
        if (size & 1) {
            size++;
        }
        var bufText = Array.prototype.slice.call(this.buf, index, index + size).map(SimpleBuffer.toStdHex);
        var buf = [''];
        for (var i = 0; i < size; i += 2) {
            buf.push(bufText[i + 1] + bufText[i]);
        }
        return JSON.parse('"' + buf.join('\\u') + '"');
    };
    SimpleBuffer.prototype.readNumber = function readNumber(index, size) {
        var ret = 0;
        for (var i = index + size; i > index;) {
            ret = this.buf[--i] + ret * 256;
        }
        return ret;
    };
    SimpleBuffer.prototype.readUInt = function readUInt(index) {
        return this.readNumber(index, 4);
    };
    SimpleBuffer.prototype.readULong = function readULong(index) {
        return this.readNumber(index, 8);
    };
    SimpleBuffer.prototype.readHex = function readHex(index, size) {
        return Array.prototype.slice.call(this.buf, index, index + size).map(SimpleBuffer.toStdHex).join('');
    };

    function DuParser() {}
    DuParser.parse = function generalDuCodeParse(szUrl) {
        var r;
        if (szUrl.indexOf('bdpan') === 0) {
            r = DuParser.parseDu_v1(szUrl);
            r.ver = 'PanDL';
        } else if (szUrl.indexOf('BDLINK') === 0) {
            r = DuParser.parseDu_v2(szUrl);
            r.ver = '游侠 v1';
        } else if (szUrl.indexOf('BaiduPCS-Go') === 0) {
            r = DuParser.parseDu_v3(szUrl);
            r.ver = 'PCS-Go';
        } else {
            r = DuParser.parseDu_v4(szUrl);
            r.ver = '梦姬标准';
        }
        return r;
    };

    DuParser.parseDu_v1 = function parseDu_v1(szUrl) {
        return szUrl.replace(/\s*bdpan:\/\//g, ' ').trim().split(' ').map(function (z) {
            return z.trim().fromBase64().match(/([\s\S]+)\|([\d]{1,20})\|([\dA-Fa-f]{32})\|([\dA-Fa-f]{32})/);
        }).filter(function (z) {
            return z;
        }).map(function (info) {
            return {
                md5: info[3].toLowerCase(),
                md5s: info[4].toLowerCase(),
                size: info[2],
                path: info[1]
            };
        });
    };

    DuParser.parseDu_v2 = function parseDu_v2(szUrl) {
        var raw = atob(szUrl.slice(6).replace(/\s/g, ''));
        if (raw.slice(0, 5) !== 'BDFS\x00') {
            return null;
        }
        var buf = new SimpleBuffer(raw);
        var ptr = 9;
        var arrFiles = [];
        var fileInfo, nameSize;
        var total = buf.readUInt(5);
        var i;
        for (i = 0; i < total; i++) {
            // 大小 (8 bytes)
            // MD5 + MD5S (0x20)
            // nameSize (4 bytes)
            // Name (unicode)
            fileInfo = {};
            fileInfo.size = buf.readULong(ptr + 0);
            fileInfo.md5 = buf.readHex(ptr + 8, 0x10);
            fileInfo.md5s = buf.readHex(ptr + 0x18, 0x10);
            nameSize = buf.readUInt(ptr + 0x28) << 1;
            fileInfo.nameSize = nameSize;
            ptr += 0x2C;
            fileInfo.path = buf.readUnicode(ptr, nameSize);
            arrFiles.push(fileInfo);
            ptr += nameSize;
        }
        return arrFiles;
    };

    DuParser.parseDu_v3 = function parseDu_v3(szUrl) {
        return szUrl.split('\n').map(function (z) {
            // unsigned long long: 0~18446744073709551615
            return z.trim().match(/-length=([\d]{1,20}) -md5=([\dA-Fa-f]{32}) -slicemd5=([\dA-Fa-f]{32})[\s\S]+"([\s\S]+)"/);
        }).filter(function (z) {
            return z;
        }).map(function (info) {
            return {
                md5: info[2],
                md5s: info[3],
                size: info[1],
                path: info[4]
            };
        });
    };

    DuParser.parseDu_v4 = function parseDu_v4(szUrl) {
        return szUrl.split('\n').map(function (z) {
            // unsigned long long: 0~18446744073709551615
            return z.trim().match(/([\dA-Fa-f]{32})#([\dA-Fa-f]{32})#([\d]{1,20})#([\s\S]+)/);
        }).filter(function (z) {
            return z;
        }).map(function (info) {
            return {
                md5: info[1].toLowerCase(),
                md5s: info[2].toLowerCase(),
                size: info[3],
                path: info[4]
            };
        });
    };

    function saveFile(i, try_flag) {
        if (i >= codeInfo.length) {
            Swal.fire(_extends({
                title: (check_mode ? '测试' : '转存') + '\u5B8C\u6BD5 \u5171' + codeInfo.length + '\u4E2A \u5931\u8D25' + failed + '\u4E2A!',
                confirmButtonText: check_mode ? '复制秒传代码' : '确定',
                showCloseButton: true,
                html: ''
            }, check_mode && checkbox_par, {
                onBeforeOpen: function onBeforeOpen() {
                    var content = Swal.getContent();
                    codeInfo.forEach(function (item) {
                        if (item.hasOwnProperty('errno')) {
                            var file_name = item.path;
                            if (item.errno === 2 && item.size > 21474836480) {
                                item.errno = 3939;
                            }
                            var errText = checkErrno(item.errno, item.size);
                            var str1 = '\u6587\u4EF6\uFF1A' + file_name;
                            var str2 = '\u5931\u8D25\u539F\u56E0\uFF1A' + errText + '(#' + item.errno + ')';
                            var ele1 = document.createElement('p');
                            var ele2 = document.createElement('p');
                            var text1 = document.createTextNode(str1);
                            var text2 = document.createTextNode(str2);
                            ele1.appendChild(text1);
                            ele2.appendChild(text2);
                            content.appendChild(ele1);
                            content.appendChild(ele2);
                        }
                    });
                    Add_content(content);
                    var _dir = (dir || '').replace(/\/$/, '');
                    if (_dir) {
                        var cBtn = Swal.getConfirmButton();
                        var btn = cBtn.cloneNode();
                        btn.textContent = '打开目录';
                        btn.style.backgroundColor = '#ecae3c';
                        btn.onclick = function () {
                            location.href = location.origin + '/disk/home?#/all?vmode=list&path=' + encodeURIComponent(_dir);
                            Swal.close();
                        };
                        cBtn.before(btn);
                    }
                }
            })).then(function (result) {
                if (check_mode) {
                    if (!result.dismiss) {
                        if (!result.value) {
                            bdcode = bdcode.replace(/\/.+\//g, '');
                        }
                        checkbox_par.inputValue = result.value;
                        GM_setValue('with_path', result.value);
                        GM_setClipboard(bdcode);
                    }
                    file_info_list = [];
                    gen_success_list = [];
                    check_mode = false;
                }
                require('system-core:system/baseService/message/message.js').trigger('system-refresh');
            });
            failed = 0;
            return;
        }
        var first_404 = false;
        var file = codeInfo[i];
        file_num.textContent = (i + 1).toString() + ' / ' + codeInfo.length.toString();
        if (file.path.match(/['"\\\:*?<>|]/)) {
            codeInfo[i].errno = 2333;
            saveFile(i + 1, false);
            return;
        }
        $.ajax({
            url: '/api/rapidupload' + (check_mode ? '?rtype=3' : ''),
            type: 'POST',
            data: {
                path: dir + file.path,
                'content-md5': try_flag ? file.md5.toUpperCase() : file.md5,
                'slice-md5': try_flag ? file.md5s.toUpperCase() : file.md5s,
                'content-length': file.size
            }
        }).success(function (r) {
            if (r && r.errno) {
                if (try_flag && r.errno === 404) {
                    codeInfo[i].errno = 404;
                    failed++;
                } else if (r.errno !== 404) {
                    codeInfo[i].errno = r.errno;
                    failed++;
                } else {
                    first_404 = true;
                }
            }
        }).fail(function (r) {
            codeInfo[i].errno = 114;
            failed++;
        }).always(function () {
            if (!try_flag && first_404) {
                // try UpperCase md5
                saveFile(i, true);
            } else {
                saveFile(i + 1, false);
            }
        });
    }

    function checkErrno(errno) {
        var file_size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

        switch (errno) {
            case -8:
                return '文件已存在';
            case 400:
                return '请求错误(请尝试使用最新版Chrome浏览器)';
            case 403:
                return '文件获取失败(生成过于频繁导致接口被限,请稍后再试)';
            case 404:
                return '文件不存在(秒传无效)';
            case 2:
                return '转存失败(尝试重新登录网盘账号)';
            case 3939:
                return '\u79D2\u4F20\u4E0D\u652F\u6301\u5927\u4E8E20G\u7684\u6587\u4EF6,\u6587\u4EF6\u5927\u5C0F:' + (file_size / Math.pow(1024, 3)).toFixed(2) + 'G';
            //文件大于20G时访问秒传接口实际会返回#2
            case 2333:
                return '链接内的文件路径错误(不能含有以下字符\'"\\:*?<>|)';
            //文件路径错误时接口实际也是返回#2
            case -10:
                return '网盘容量已满';
            case 114:
                return '接口调用失败(请重试)';
            case 514:
                return '接口调用失败(请重试/弹出跨域访问窗口时,请选择"总是允许"或"总是允许全部域名")';
            case 1919:
                return '文件已被和谐';
            case 810:
                return '文件列表获取失败(请重试)';
            case 996:
                return 'md5获取失败(请等待一段时间再重试)';
            default:
                return '未知错误';
        }
    }

    function GetInfo() {
        var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

        Swal.fire({
            title: '请输入提取码',
            input: 'textarea',
            inputValue: str,
            showCancelButton: true,
            inputPlaceholder: '[支持 PanDL/梦姬/游侠/PCS-Go][支持批量]',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputValidator: function inputValidator(value) {
                if (!value) {
                    return '链接不能为空';
                }
                codeInfo = DuParser.parse(value);
                if (!codeInfo.length) {
                    return '未识别到正确的链接';
                }
            }
        }).then(function (result) {
            if (result.value) {
                Process();
            }
        });
    }

    function Process() {
        if (check_mode) {
            dir = '';
            save_alert();
        } else {
            dir = GM_getValue('last_dir');
            if (!dir) {
                dir = '';
            }
            Swal.fire({
                title: '请输入保存路径',
                input: 'text',
                inputPlaceholder: '格式示例：/GTA5/，默认保存在根目录',
                inputValue: dir,
                showCancelButton: true,
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                inputValidator: function inputValidator(value) {
                    if (value.match(/['"\\\:*?<>|]/)) {
                        return '路径中不能含有以下字符\'"\\:*?<>|，格式示例：/GTA5/';
                    }
                }
            }).then(function (result) {
                if (!result.dismiss) {
                    dir = result.value;
                    GM_setValue('last_dir', dir);
                    if (dir.charAt(dir.length - 1) !== '/') {
                        dir = dir + '/';
                    }
                    save_alert();
                }
            });
        }
    }

    function save_alert() {
        Swal.fire({
            title: '\u6587\u4EF6' + (check_mode ? '测试' : '提取') + '\u4E2D',
            html: '\u6B63\u5728' + (check_mode ? '测试' : '转存') + '\u7B2C <file_num></file_num> \u4E2A',
            allowOutsideClick: false,
            onBeforeOpen: function onBeforeOpen() {
                Swal.showLoading();
                var content = Swal.getContent();
                if (content) {
                    file_num = content.querySelector('file_num');
                    saveFile(0, false);
                }
            }
        });
    }

    function GetInfo_url() {
        var bdlink = href.match(/[\?#]bdlink=([\da-zA-Z/\+]+)&?/);

        if (bdlink) {
            bdlink = bdlink[1].fromBase64();
            GetInfo(bdlink);
        } else if (!GM_getValue('1.4.5_no_first')) {
            Swal.fire({
                title: '\u79D2\u4F20\u94FE\u63A5\u63D0\u53D6 1.4.5 \u66F4\u65B0\u5185\u5BB9(21.1.12):',
                html: update_info,
                heightAuto: false,
                scrollbarPadding: false,
                showCloseButton: true,
                allowOutsideClick: false,
                confirmButtonText: '确定'
            }).then(function (result) {
                GM_setValue('1.4.5_no_first', true);
            });
        }
    }

    function Add_content(content) {
        var hasAdd = false;
        if (!GM_getValue('kill_feedback')) {
            hasAdd = true;
            content.innerHTML += '<p><br></p>';
            content.innerHTML += html_feedback;
            var loop = setInterval(function () {
                var html_tag = $("#kill_feedback");
                if (!html_tag.length) return false;
                $("#kill_feedback").click(function () {
                    GM_setValue('kill_feedback', true);
                    $("#bdcode_feedback").remove();
                });
                clearInterval(loop);
            }, 50);
        }
        if (!GM_getValue('kill_donate')) {
            if (!hasAdd) {
                content.innerHTML += '<p><br></p>';
            }
            content.innerHTML += html_donate;
            var _loop = setInterval(function () {
                var html_tag = $("#kill_donate");
                if (!html_tag.length) return false;
                $("#kill_donate").click(function () {
                    GM_setValue('kill_donate', true);
                    $("#bdcode_donate").remove();
                });
                clearInterval(_loop);
            }, 50);
        }
    }

    function sleep(time) {
        var startTime = new Date().getTime() + parseInt(time, 10);
        while (new Date().getTime() < startTime) {}
    };

    function myInit() {
        GetInfo_url();
        initButtonHome();
        initButtonGen();
    }

    function check_compa() {
        if (GM_info.scriptHandler === 'Violentmonkey') {
            if (!GM_getValue('check_compa')) var mymessage = confirm('\"秒传链接提取\" 脚本在 \"暴力猴Violentmonkey\" 插件下可能无法正常运行\n建议更换为 \"油猴Tampermonkey\" 插件, 请问是否继续?');
            if (mymessage) {
                GM_setValue('check_compa', true);
                document.addEventListener('DOMContentLoaded', myInit);
            }
        } else {
            document.addEventListener('DOMContentLoaded', myInit);
        }
    }

    var update_info = '<div class="panel-body" style="height: 250px; overflow-y:scroll">\n        <div style="border: 1px  #000000; width: 100%; margin: 0 auto;"><span>\n\n        <p>\u4FEE\u590D\u4E861.4.0\u540E\u53EF\u80FD\u51FA\u73B0\u7684\u79D2\u4F20\u6309\u94AE\u65E0\u6548\u3001\u663E\u793A\u591A\u4E2A\u79D2\u4F20\u6309\u94AE\u7684\u95EE\u9898</p>\n\n        <p><br></p>\n\n        <p>\u82E5\u51FA\u73B0\u4EFB\u4F55\u95EE\u9898\u8BF7\u524D\u5F80<a href="https://greasyfork.org/zh-CN/scripts/397324" rel="noopener noreferrer" target="_blank">greasyfork\u9875</a>\u53CD\u9988</p>\n\n        <p><br></p>\n\n        <p>1.3.7 \u66F4\u65B0\u5185\u5BB9(21.1.3):</p>\n\n        <p>\u4FEE\u590D\u4E86\u4F1A\u5458\u8D26\u53F7\u751F\u621050M\u4EE5\u4E0B\u6587\u4EF6\u65F6\u63D0\u793A "md5\u83B7\u53D6\u5931\u8D25" \u7684\u95EE\u9898</p>\n\n        <p><br></p>\n\n        <p>1.3.3 \u66F4\u65B0\u5185\u5BB9(20.12.1):</p>\n\n        <p>\u79D2\u4F20\u751F\u6210\u5B8C\u6210\u540E\u70B9\u51FB\u590D\u5236\u6309\u94AE\u4E4B\u524D\u90FD\u53EF\u4EE5\u7EE7\u7EED\u4EFB\u52A1,\u9632\u6B62\u8BEF\u64CD\u4F5C\u5173\u95ED\u9875\u9762\u5BFC\u81F4\u751F\u6210\u7ED3\u679C\u4E22\u5931</p>\n\n        <p>\u4FEE\u6539\u4EE3\u7801\u6267\u884C\u987A\u5E8F\u9632\u6B62\u79D2\u4F20\u6309\u94AE\u51FA\u73B0\u5728\u6700\u5DE6\u7AEF</p>\n\n        <p>\u4FEE\u590D\u4E86\u8DE8\u57DF\u63D0\u793A\u4E2D\u5931\u6548\u7684\u8BF4\u660E\u56FE\u7247</p>\n\n        <p><br></p>\n\n        <p>1.2.9 \u66F4\u65B0\u5185\u5BB9(20.11.11):</p>\n        \n        <p>\u751F\u6210\u79D2\u4F20\u7684\u5F39\u7A97\u6DFB\u52A0\u4E86\u5173\u95ED\u6309\u94AE</p>\n        \n        <p>\u5220\u9664\u4E86\u5168\u90E8\u751F\u6210\u5931\u8D25\u65F6\u7684\u590D\u5236\u548C\u6D4B\u8BD5\u6309\u94AE</p>\n\n        <p>\u79D2\u4F20\u751F\u6210\u540E\u52A0\u4E86\u4E00\u4E2A\u5BFC\u51FA\u6587\u4EF6\u8DEF\u5F84\u7684\u9009\u9879(\u9ED8\u8BA4\u4E0D\u5BFC\u51FA)</p>\n\n        <p>\u5728\u8F93\u5165\u4FDD\u5B58\u8DEF\u5F84\u7684\u5F39\u7A97\u6DFB\u52A0\u4E86\u6821\u9A8C\uFF0C\u9632\u6B62\u8F93\u5165\u9519\u8BEF\u8DEF\u5F84</p>\n\n        <p><br></p>\n\n        <p>1.2.5 \u66F4\u65B0\u5185\u5BB9(20.11.4):</p>\n        \n        <p>\u4F18\u5316\u6309\u94AE\u6837\u5F0F\uFF0C\u6DFB\u52A0\u4E86md5\u83B7\u53D6\u5931\u8D25\u7684\u62A5\u9519</p>\n\n        <p>\u4FEE\u590D\u4ECEpan.baidu.com\u8FDB\u5165\u540E\u4E0D\u663E\u793A\u751F\u6210\u6309\u94AE\u7684\u95EE\u9898</p>\n        \n        <p><br></p>\n        \n        <p>1.2.4 \u66F4\u65B0\u5185\u5BB9(20.11.2):</p>\n        \n        <p>\u65B0\u589E\u751F\u6210\u79D2\u4F20:</p>\n        \n        <p>\u9009\u62E9\u6587\u4EF6\u6216\u6587\u4EF6\u5939\u540E\u70B9\u51FB "\u751F\u6210\u79D2\u4F20" \u5373\u53EF\u5F00\u59CB\u751F\u6210</p>\n        \n        <p><br></p>\n        \n        <p>\u7EE7\u7EED\u672A\u5B8C\u6210\u4EFB\u52A1:</p>\n        \n        <p>\u82E5\u751F\u6210\u79D2\u4F20\u671F\u95F4\u5173\u95ED\u4E86\u7F51\u9875, \u518D\u6B21\u70B9\u51FB "\u751F\u6210\u79D2\u4F20" \u5373\u53EF\u7EE7\u7EED\u4EFB\u52A1</p>\n        \n        <p><br></p>\n        \n        <p>\u6D4B\u8BD5\u79D2\u4F20\u529F\u80FD:</p>\n        \n        <p>\u751F\u6210\u5B8C\u6210\u540E, \u70B9\u51FB"\u6D4B\u8BD5"\u6309\u94AE, \u4F1A\u81EA\u52A8\u8F6C\u5B58\u5E76\u8986\u76D6\u6587\u4EF6(\u6587\u4EF6\u5185\u5BB9\u4E0D\u53D8), \u4EE5\u68C0\u6D4B\u79D2\u4F20\u6709\u6548\u6027, \u4EE5\u53CA\u4FEE\u590Dmd5\u9519\u8BEF\u9632\u6B62\u79D2\u4F20\u5931\u6548</p>\n        \n        </span></div></div>';

    var href = window.location.href;
    check_compa();
}();
