// ==UserScript==
// @name              秒传链接提取
// @namespace         moe.cangku.mengzonefire
// @version           1.2.5
// @description       用于提取百度网盘秒传链接
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
// @run-at            document-start
// @connect           *
// ==/UserScript==
! function () {
    'use strict';
    const api_url = 'https://pan.baidu.com/api/list';
    const pcs_url = 'https://pcs.baidu.com/rest/2.0/pcs/file';
    const appid_list = ['250528', '265486', '266719', '778750', '498065', '309847'];
    //使用'250528', '265486', '266719'，下载50M以上的文件会报403，黑号情况下部分文件也会报403
    const bad_md5 = ['fcadf26fc508b8039bee8f0901d9c58e', '2d9a55b7d5fe70e74ce8c3b2be8f8e43'];
    var select_list,
        failed = 0,
        check_mode = false,
        file_info_list = [],
        gen_success_list = [],
        dir, file_num, gen_num, gen_prog, list_path, codeInfo, recursive, bdcode;
    const html_btn = `<a class="g-button g-button-blue href="javascript:;" id="bdlink_btn" title="秒传链接" style="display: inline-block;"">
    <span class="g-button-right"><em class="icon icon-disk" title="秒传链接提取"></em><span class="text" style="width: auto;">秒传链接</span></span></a>`;
    const html_btn_gen = `<a class="g-button gen-bdlink-button"><span class="g-button-right"><em class="icon icon-share" title="生成秒传">
    </em><span class="text">生成秒传</span></span></a>`;
    const html_check_md5 = `<p style="width: 100%;height: 34px;display: block;line-height: 34px;text-align: center;">测试秒传, 可防止秒传失效
    <a class="g-button g-button-blue" id="check_md5_btn"><span class="g-button-right"><span class="text" style="width: auto;">测试</span>
    </span></a></p><p>注意: 测试秒传会转存并覆盖文件,若在生成期间修改过同名文件,为避免修改的文件丢失,请不要使用此功能!</p>`;

    if (Base64.extendString) {
        Base64.extendString();
    }

    let loop = setInterval(() => {
        var html_tag = $("div.tcuLAu");
        if (!html_tag.length) return false;
        html_tag.append(html_btn);
        $("#bdlink_btn").click(function () {
            GetInfo();
        });
        clearInterval(loop);
    }, 500);

    function add_file_list(file_list, first) {
        var dir_list = [];
        file_list.forEach(function (item) {
            if (item.isdir) {
                dir_list.push(item.path);
            } else {
                file_info_list.push({
                    'path': item.path,
                    'size': item.size,
                });
            }
        });
        if (dir_list.length) {
            if (first) {
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
                    cancelButtonText: '否',
                }).then((result) => {
                    if (result.value) {
                        recursive = true;
                    } else if (
                        result.dismiss === Swal.DismissReason.cancel
                    ) {
                        recursive = false;
                    } else {
                        return;
                    }
                    get_file_list(dir_list);
                });
            } else if (recursive) {
                list_dir(dir_list, 0);
            } else {
                Gen_bdlink();
            }
        } else {
            Gen_bdlink();
        }
    }

    function get_file_list(dir_list) {
        Swal.fire({
            title: '正在获取文件列表, 请稍等',
            html: '<p><list_path></list_path></p>',
            allowOutsideClick: false,
            onBeforeOpen: () => {
                Swal.showLoading();
                var content = Swal.getContent();
                if (content) {
                    list_path = content.querySelector('list_path');
                    list_dir(dir_list, 0);
                }
            }
        });
    }

    function list_dir(dir_list, dir_id, output_list = []) {
        if (dir_id >= dir_list.length) {
            add_file_list(output_list, false);
            return;
        }
        var path = dir_list[dir_id];
        list_path.textContent = path;
        var list_dir_par = {
            url: api_url + `?app_id=250528&dir=${encodeURIComponent(path)}&num=0`,
            type: 'GET',
            responseType: 'json',
            onload: function (r) {
                if (!r.response.errno) {
                    output_list = output_list.concat(r.response.list);
                } else {
                    file_info_list.push({
                        'path': path,
                        'errno': 810
                    });
                }
                list_dir(dir_list, dir_id + 1, output_list);
            },
            onerror: function (r) {
                file_info_list.push({
                    'path': path,
                    'errno': 114514
                });
                list_dir(dir_list, dir_id + 1, output_list);
            }
        };
        GM_xmlhttpRequest(list_dir_par);
    }

    function initButtonEvent() {
        $(document).on("click", ".gen-bdlink-button", function () {
            if (!GM_getValue('gen_no_first')) {
                Swal.fire({
                    title: '首次使用请注意',
                    showCloseButton: true,
                    allowOutsideClick: false,
                    html: '<p>弹出跨域访问窗口时, 请选择 "总是允许全部域名"</p><img style="max-width: 100%; height: auto" src="https://i.loli.net/2020/11/01/U2kxfmnGlweqhbt.png">'
                }).then((result) => {
                    if (result.value) {
                        GM_setValue('gen_no_first', true);
                        select_list = getSelectedFileList();
                        add_file_list(select_list, true);
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
                }).then((result) => {
                    if (result.value) {
                        file_info_list = GM_getValue('unfinish').file_info_list;
                        Gen_bdlink(GM_getValue('unfinish').file_id);
                    } else {
                        GM_deleteValue('unfinish');
                        select_list = getSelectedFileList();
                        add_file_list(select_list, true);
                    }
                });
            } else {
                select_list = getSelectedFileList();
                add_file_list(select_list, true);
            }
        });
    }

    function getSelectedFileList() {
        return unsafeWindow.require('system-core:context/context.js').instanceForSystem.list.getSelected();
    };

    function initButtonHome() {
        var listTools = getSystemContext().Broker.getButtonBroker("listTools");
        if (listTools && listTools.$box) {
            $(listTools.$box).children('div').after(html_btn_gen);
            initButtonEvent();
        } else {
            setTimeout(initButtonHome, 500);
        }
    };

    function getSystemContext() {
        return unsafeWindow.require("system-core:context/context.js").instanceForSystem;
    };

    function Gen_bdlink(file_id = 0) {
        Swal.fire({
            title: '秒传生成中',
            allowOutsideClick: false,
            html: '<p>正在生成第 <gen_num></gen_num> 个</p><p><gen_prog></gen_prog></p>',
            onBeforeOpen: () => {
                Swal.showLoading()
                var content = Swal.getContent();
                if (content) {
                    gen_num = content.querySelector('gen_num');
                    gen_prog = content.querySelector('gen_prog');
                    myGenerater(file_id);
                }
            }
        });
    }

    var show_prog = function (r) {
        gen_prog.textContent = `${parseInt((r.loaded/r.total)*100)}%`;
    };

    function myGenerater(file_id, appid_id = 0, failed = false) {
        if (file_id >= file_info_list.length) {
            bdcode = '';
            var failed_info = '';
            var gen_failed = 0;
            file_info_list.forEach(function (item) {
                if (item.hasOwnProperty('errno')) {
                    gen_failed++;
                    failed_info += `<p>文件：${item.path}</p><p>失败原因：${checkErrno(item.errno)}(#${item.errno})</p>`
                } else {
                    gen_success_list.push(item);
                    bdcode += `${item.md5}#${item.md5s}#${item.size}#${item.path}\n`;
                }
            });
            bdcode = bdcode.trim();
            if (failed_info) {
                failed_info = '<p><br></p><p>失败文件列表:</p>' + failed_info;
            }
            GM_deleteValue('unfinish');
            Swal.fire({
                title: `生成完毕 共${file_info_list.length}个, 失败${gen_failed}个!`,
                confirmButtonText: '复制秒传代码',
                showCloseButton: true,
                allowOutsideClick: false,
                html: html_check_md5 + failed_info,
                onBeforeOpen: () => {
                    $("#check_md5_btn").click(function () {
                        codeInfo = gen_success_list;
                        check_mode = true;
                        Process();
                    });
                }
            }).then((result) => {
                file_info_list = [];
                gen_success_list = [];
                if (result.value) {
                    GM_setClipboard(bdcode);
                }
            });
            return;
        }
        GM_setValue('unfinish', {
            'file_info_list': file_info_list,
            'file_id': file_id
        });
        var file_info = file_info_list[file_id];
        if (file_info.hasOwnProperty('errno')) {
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
            url: pcs_url + `?app_id=${appid_list[appid_id]}&method=download&path=${encodeURIComponent(path)}`,
            type: 'GET',
            headers: {
                'Range': `bytes=0-${dl_size}`
            },
            responseType: 'arraybuffer',
            onprogress: show_prog,
            onerror: function (r) {
                file_info.errno = 114514;
                myGenerater(file_id + 1);
            },
            onload: function (r) {
                if (parseInt(r.status / 100) == 2) {
                    var responseHeaders = r.responseHeaders;
                    var file_md5 = responseHeaders.match(/content-md5: ([\da-f]{32})/);
                    if (file_md5) {
                        file_md5 = file_md5[1];
                    } else {
                        file_info.errno = 996;
                        myGenerater(file_id + 1);
                        return;
                    }
                    //bad_md5内的两个md5是和谐文件返回的，第一个是txt格式的"温馨提示.txt"，第二个是视频格式的（俗称5s）
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
                    if (r.status == 403 && appid_id < appid_list.length - 1) {
                        myGenerater(path, file_id, appid_id + 1, true);
                    } else {
                        file_info.errno = r.status;
                        myGenerater(file_id + 1);
                    }
                }
            }
        };
        GM_xmlhttpRequest(get_dl_par);
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
            ret = this.buf[--i] + (ret * 256);
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
            return z.trim().fromBase64().match(/([\s\S]+)\|([\d]{1,20})\|([\da-f]{32})\|([\da-f]{32})/);
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
            return z.trim().match(/-length=([\d]{1,20}) -md5=([\da-f]{32}) -slicemd5=([\da-f]{32})[\s\S]+"([\s\S]+)"/)
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
            Swal.fire({
                title: `${check_mode?'测试':'转存'}完毕 共${codeInfo.length}个 失败${failed}个!`,
                confirmButtonText: check_mode ? '复制秒传代码' : '确定',
                showCloseButton: true,
                html: '',
                onBeforeOpen: () => {
                    var content = Swal.getContent();
                    codeInfo.forEach(function (item) {
                        if (item.hasOwnProperty('errno')) {
                            var file_name = item.path;
                            var errText = checkErrno(item.errno);
                            var str1 = `文件名：${file_name}`;
                            var str2 = `失败原因：${errText}(#${item.errno})`;
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
                    const _dir = (dir || '').replace(/\/$/, '');
                    if (_dir) {
                        const cBtn = Swal.getConfirmButton();
                        const btn = cBtn.cloneNode();
                        btn.textContent = '打开目录';
                        btn.style.backgroundColor = '#ecae3c';
                        btn.onclick = () => {
                            location.href = `${location.origin}/disk/home?#/all?vmode=list&path=${encodeURIComponent(_dir)}`;
                            Swal.close();
                        }
                        cBtn.before(btn);
                    }

                }
            }).then((result) => {
                if (check_mode) {
                    if (result.value) {
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
        $.ajax({
            url: `/api/rapidupload${check_mode?'?rtype=3':''}`,
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
            codeInfo[i].errno = 114514;
            failed++;
        }).always(function () {
            if (!try_flag && first_404) {
                // try UpperCase md5
                saveFile(i, true)
            } else {
                saveFile(i + 1, false);
            }
        });
    }

    function checkErrno(errno) {
        switch (errno) {
            case -8:
                return '文件已存在';
            case 403:
                return '文件获取失败';
            case 404:
                return '文件不存在(秒传无效)';
            case 2:
                return '转存失败(重新登录/检查保存路径)';
            case -10:
                return '网盘容量已满';
            case 114514:
                return '接口调用失败(请重试)';
            case 1919:
                return '文件已被和谐';
            case 810:
                return '文件列表获取失败(请重试)';
            case 996:
                return 'md5获取失败(请重试)';
            default:
                return '未知错误';
        }
    }

    function GetInfo(str = '') {
        Swal.fire({
            title: '请输入提取码',
            input: 'textarea',
            inputValue: str,
            showCancelButton: true,
            inputPlaceholder: '[支持 PanDL/梦姬/游侠/PCS-Go][支持批量]',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputValidator: (value) => {
                if (!value) {
                    return '链接不能为空';
                }
                codeInfo = DuParser.parse(value);
                if (!codeInfo.length) {
                    return '未识别到正确的链接';
                }
            }
        }).then((result) => {
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
                text: '不要填写例如D:\\GTA5这种本地路径!',
                input: 'text',
                inputPlaceholder: '格式示例：/GTA5/，默认保存在根目录',
                inputValue: dir,
                showCancelButton: true,
                confirmButtonText: '确定',
                cancelButtonText: '取消',
            }).then((result) => {
                if (result.value) {
                    dir = result.value;
                    GM_setValue('last_dir', dir);
                    if (dir.charAt(dir.length - 1) != '/') {
                        dir = dir + '/';
                    }
                }
                save_alert();
            });
        }
    }

    function save_alert() {
        Swal.fire({
            title: `文件${check_mode?'测试':'提取'}中`,
            html: `正在${check_mode?'测试':'转存'}第 <file_num></file_num> 个`,
            allowOutsideClick: false,
            onBeforeOpen: () => {
                Swal.showLoading()
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
            GetInfo(bdlink)
        } else if (!GM_getValue('1.2.5_no_first')) {
            Swal.fire({
                title: `秒传链接提取 1.2.5 更新内容(20.11.4):`,
                html: update_info,
                allowOutsideClick: false,
                confirmButtonText: '确定'
            }).then((result) => {
                GM_setValue('1.2.5_no_first', true)
            });
        }
    }

    function sleep(time) {
        var startTime = new Date().getTime() + parseInt(time, 10);
        while (new Date().getTime() < startTime) {}
    };

    const update_info =
        `<p>优化按钮样式，添加了md5获取失败的报错</p>

        <p>修复从pan.baidu.com进入后不显示生成按钮的问题</p>
        
        <p>若出现任何问题请前往<a href="https://greasyfork.org/zh-CN/scripts/397324/feedback" rel="noopener noreferrer" target="_blank">greasyfork页</a>反馈</p>
        
        <p>
            <br>
        </p>
        
        <p>1.2.4 更新内容(20.11.2):</p>
        
        <p>新增生成秒传:</p>
        
        <p>选择文件或文件夹后点击 "生成秒传" 即可开始生成</p>
        
        <p>
            <br>
        </p>
        
        <p>继续未完成任务:</p>
        
        <p>若生成秒传期间关闭了网页, 再次点击 "生成秒传" 即可继续任务</p>
        
        <p>
            <br>
        </p>
        
        <p>测试秒传功能:</p>
        
        <p>生成完成后, 点击"测试"按钮, 会自动转存并覆盖文件(文件内容不变), 以检测秒传有效性, 以及修复md5错误防止秒传失效</p>`;

    const href = window.location.href;
    document.addEventListener('DOMContentLoaded', GetInfo_url);
    document.addEventListener('DOMContentLoaded', initButtonHome);
}();