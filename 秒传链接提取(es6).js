// ==UserScript==
// @name              秒传链接提取
// @namespace         moe.cangku.mengzonefire
// @version           1.5.4
// @description       用于提取和生成百度网盘秒传链接
// @author            mengzonefire
// @match             *://pan.baidu.com/disk/home*
// @match             *://yun.baidu.com/disk/home*
// @resource sweetalert2Css https://cdn.jsdelivr.net/npm/sweetalert2@8/dist/sweetalert2.min.css
// @require           https://cdn.jsdelivr.net/npm/sweetalert2@8/dist/sweetalert2.min.js
// @require           https://cdn.jsdelivr.net/npm/js-base64
// @require           https://cdn.staticfile.org/spark-md5/3.0.0/spark-md5.min.js
// @grant             GM_setValue
// @grant             GM_getValue
// @grant             GM_deleteValue
// @grant             GM_setClipboard
// @grant             GM_xmlhttpRequest
// @grant             GM_info
// @grant             GM_getResourceText
// @grant             GM_addStyle
// @run-at            document-start
// @connect           *
// ==/UserScript==
! function () {
    'use strict';
    const meta_url = 'http://pcs.baidu.com/rest/2.0/pcs/file?app_id=778750&method=meta&path=';
    const info_url = 'https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo';
    const api_url = 'http://pan.baidu.com/rest/2.0/xpan/multimedia?method=listall&order=name&limit=10000';
    const pcs_url = 'https://pcs.baidu.com/rest/2.0/pcs/file';
    const appid_list = ['266719', '265486', '250528', '778750', '498065', '309847'];
    //使用'250528', '265486', '266719', 下载50M以上的文件会报403, 黑号情况下部分文件也会报403
    const bad_md5 = ['fcadf26fc508b8039bee8f0901d9c58e', '2d9a55b7d5fe70e74ce8c3b2be8f8e43', 'b912d5b77babf959865100bf1d0c2a19'];
    const css_url = {
        'Minimal': 'https://cdn.jsdelivr.net/npm/sweetalert2@8/dist/sweetalert2.min.css',
        'Dark': 'https://cdn.jsdelivr.net/npm/@sweetalert2/theme-dark@4/dark.css',
        'WordPress Admin': 'https://cdn.jsdelivr.net/npm/@sweetalert2/theme-wordpress-admin@4/wordpress-admin.css',
        'Material UI': 'https://cdn.jsdelivr.net/npm/@sweetalert2/theme-material-ui@4/material-ui.css',
        'Bulma': 'https://cdn.jsdelivr.net/npm/@sweetalert2/theme-bulma@4/bulma.css',
        'Bootstrap 4': 'https://cdn.jsdelivr.net/npm/@sweetalert2/theme-bootstrap-4@4/bootstrap-4.css'
    };
    var select_list,
        failed = 0,
        vip_type = 0,
        interval = 0,
        check_mode = false,
        interval_mode = false,
        file_info_list = [],
        gen_success_list = [],
        dir, file_num, gen_num, gen_prog, codeInfo, recursive, bdcode, xmlhttpRequest;
    const myStyle = `style="width: 100%;height: 34px;display: block;line-height: 34px;text-align: center;"`;
    const myBtnStyle = `style="height: 26px;line-height: 26px;vertical-align: middle;"`;
    const html_btn = `<a class="g-button g-button-blue" id="bdlink_btn" title="秒传链接" style="display: inline-block;"">
    <span class="g-button-right"><em class="icon icon-disk" title="秒传链接提取"></em><span class="text" style="width: auto;">秒传链接</span></span></a>`;
    const html_btn_gen = `<a class="g-button gen-bdlink-button"><span class="g-button-right"><em class="icon icon-share" title="生成秒传"></em><span class="text">生成秒传</span></span></a>`;
    const html_check_md5 = `<p ${myStyle}>测试秒传, 可防止秒传失效<a class="g-button g-button-blue" id="check_md5_btn" ${myBtnStyle}><span class="g-button-right" ${myBtnStyle}><span class="text" style="width: auto;">测试</span></span></a></p>`;
    const html_document = `<p ${myStyle}>分享过程中遇到问题可参考<a class="g-button g-button-blue" ${myBtnStyle} href="https://shimo.im/docs/TZ1JJuEjOM0wnFDH" rel="noopener noreferrer" target="_blank"><span class="g-button-right" ${myBtnStyle}><span class="text" style="width: auto;">防爆教程</span></span></a></p>`;
    const html_donate = `<p id="bdcode_donate" ${myStyle}>若喜欢该脚本, 可前往 <a href="https://afdian.net/@mengzonefire" rel="noopener noreferrer" target="_blank">赞助页</a> 支持作者
    <a class="g-button" id="kill_donate" ${myBtnStyle}><span class="g-button-right" ${myBtnStyle}><span class="text" style="width: auto;">不再显示</span></span></a></p>`;
    const html_feedback = `<p id="bdcode_feedback" ${myStyle}>若有任何疑问, 可前往 <a href="https://greasyfork.org/zh-CN/scripts/397324" rel="noopener noreferrer" target="_blank">脚本页</a> 反馈
    <a class="g-button" id="kill_feedback" ${myBtnStyle}><span class="g-button-right" ${myBtnStyle}><span class="text" style="width: auto;">不再显示</span></span></a></p>`;
    const csd_hint_html = '<p>弹出跨域访问窗口时,请选择"总是允许"或"总是允许全部域名"</p><img style="max-width: 100%; height: auto" src="https://pic.rmb.bdstatic.com/bjh/763ff5014cca49237cb3ede92b5b7ac5.png">';
    var checkbox_par = {
        input: 'checkbox',
        inputValue: GM_getValue('with_path'),
        inputPlaceholder: '导出文件夹目录结构',
    };
    var show_prog = function (r) {
        gen_prog.textContent = `${parseInt((r.loaded/r.total)*100)}%`;
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
                    'size': item.size,
                });
            }
        });
        if (dir_list.length) {
            Swal.fire({
                type: 'info',
                title: '选择中包含文件夹, 是否递归生成?',
                text: '若选是, 将同时生成各级子文件夹下的文件',
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
                add_dir_list(dir_list);
            });
        } else {
            Gen_bdlink();
        }
    }

    function add_dir_list(dir_list, dir_id = 0) {
        if (dir_id >= dir_list.length) {
            Gen_bdlink();
            return;
        }
        var path = dir_list[dir_id];
        var list_dir_par = {
            url: api_url + `&path=${encodeURIComponent(path)}&recursion=${recursive ? 1 : 0}`,
            type: 'GET',
            responseType: 'json',
            onload: function (r) {
                if (parseInt(r.status / 100) === 2) {
                    if (!r.response.errno) {
                        r.response.list.forEach(function (item) {
                            item.isdir || file_info_list.push({
                                'path': item.path,
                                'size': item.size,
                            });
                        });
                    } else {
                        file_info_list.push({
                            'path': path,
                            'errno': 810
                        });
                    }
                } else {
                    file_info_list.push({
                        'path': path,
                        'errno': r.status
                    });
                }
                add_dir_list(dir_list, dir_id + 1);
            },
            onerror: function (r) {
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
        $(document).on('click', '.gen-bdlink-button', function () {
            if (!GM_getValue('gen_no_first')) {
                Swal.fire({
                    title: '首次使用请注意',
                    showCloseButton: true,
                    allowOutsideClick: false,
                    html: csd_hint_html,
                }).then((result) => {
                    if (result.value) {
                        GM_setValue('gen_no_first', true);
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
                    cancelButtonText: '取消',
                }).then((result) => {
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
        let loop = setInterval(() => {
            var html_tag = $('div.tcuLAu');
            if (!html_tag.length) return false;
            if (!$('#h5Input0').length) return false;
            html_tag.append(html_btn);
            let loop2 = setInterval(() => {
                var btn_tag = $('#bdlink_btn');
                if (!btn_tag.length) return false;
                btn_tag.click(function () {
                    GetInfo();
                });
                clearInterval(loop2);
            }, 50);
            clearInterval(loop);
        }, 50);
    }

    function initButtonGen() {
        var listTools = getSystemContext().Broker.getButtonBroker('listTools');
        if (listTools && listTools.$box) {
            $(listTools.$box).children('div').after(html_btn_gen);
            initButtonEvent();
        } else {
            setTimeout(initButtonGen, 500);
        }
    };

    function getSystemContext() {
        return unsafeWindow.require('system-core:context/context.js').instanceForSystem;
    };

    function Gen_bdlink(file_id = 0) {
        if (file_info_list.length > 10 && vip_type === 2 && !interval_mode) {
            Set_interval(file_id);
            return;
        }
        Swal.fire({
            title: '秒传生成中',
            showCloseButton: true,
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
        }).then((result) => {
            if (result.dismiss && xmlhttpRequest) {
                xmlhttpRequest.abort();
                GM_deleteValue('unfinish');
                interval_mode = false;
                file_info_list = [];
            }
        });
    }

    function Set_interval(file_id) {
        var test_par = /\d+/;
        interval = GM_getValue('interval') || 15;
        Swal.fire({
            title: '批量生成注意',
            text: '检测到超会账号且生成的文件较多, 会因为生成过快导致接口被限制(#403), 请输入生成间隔(1-30秒,推荐15)防止上述情况',
            input: 'text',
            inputValue: interval,
            showCancelButton: false,
            allowOutsideClick: false,
            confirmButtonText: '确定',
            inputValidator: (value) => {
                if (!value) {
                    return '不能为空';
                }
                if (!test_par.test(value)) {
                    return '输入格式不正确, 请输入数字';
                }
                if (Number(value) > 30 || Number(value) < 1) {
                    return '输入应在1-30之间';
                }
            }
        }).then((result) => {
            interval = Number(result.value);
            GM_setValue('interval', interval);
            interval_mode = true;
            Gen_bdlink(file_id);
        });
    }

    var show_prog = function (r) {
        gen_prog.textContent = `${parseInt((r.loaded / r.total) * 100)}%`;
    };

    function test_bdlink() {
        if (!GM_getValue('show_test_warning')) {
            Swal.fire({
                title: '注意',
                text: '测试秒传会转存并覆盖文件,若在生成期间修改过同名文件,为避免修改的文件丢失,请不要使用此功能!',
                input: 'checkbox',
                inputPlaceholder: '不再显示',
                showCancelButton: true,
                allowOutsideClick: false,
                confirmButtonText: '确定',
                cancelButtonText: '返回'
            }).then((result) => {
                GM_setValue('show_test_warning', result.value)
                if (!result.dismiss) {
                    codeInfo = gen_success_list;
                    check_mode = true;
                    Process();
                } else {
                    gen_success_list = [];
                    myGenerater(file_info_list.length);
                }
            });
        } else {
            codeInfo = gen_success_list;
            check_mode = true;
            Process();
        }
    }

    function myGenerater(file_id, appid_id = 0, failed = false) {
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
                    failed_info += `<p>文件：${item.path}</p><p>失败原因：${checkErrno(item.errno, item.size)}(#${item.errno})</p>`
                } else {
                    gen_success_list.push(item);
                    bdcode += `${item.md5}#${item.md5s}#${item.size}#${item.path}\n`;
                }
            });
            bdcode = bdcode.trim();
            if (failed_info) {
                failed_info = '<p>失败文件列表:</p>' + failed_info;
            }
            Swal.fire({
                title: `生成完毕 共${file_info_list.length}个, 失败${gen_failed}个!`,
                confirmButtonText: '复制秒传代码',
                cancelButtonText: '取消',
                showCloseButton: true,
                showCancelButton: !bdcode,
                showConfirmButton: bdcode,
                allowOutsideClick: false,
                html: bdcode ? (html_check_md5 + html_document + (failed_info && ('<p><br></p>' + failed_info))) : html_document + '<p><br></p>' + failed_info,
                ...(bdcode && checkbox_par),
                onBeforeOpen: () => {
                    let loop = setInterval(() => {
                        var html_tag = $('#check_md5_btn');
                        if (!html_tag.length) return false;
                        $('#check_md5_btn').click(function () {
                            test_bdlink();
                        });
                        clearInterval(loop);
                    }, 50);
                    Add_content(document.createElement('div'));
                }
            }).then((result) => {
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
                interval_mode = false;
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
        gen_prog.textContent = '0%';

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
            ontimeout: function (r) {
                myGenerater(file_id);
                console.log('timeout !!!');
            },
            onerror: function (r) {
                file_info.errno = 514;
                myGenerater(file_id + 1);
            },
            onload: function (r) {
                if (parseInt(r.status / 100) === 2) {
                    var responseHeaders = r.responseHeaders;
                    var file_md5 = responseHeaders.match(/content-md5: ([\da-f]{32})/i);
                    if (file_md5) {
                        file_md5 = file_md5[1].toLowerCase();
                    } else {
                        try_get_md5(file_id, r.response);
                        return;
                    }
                    //bad_md5内的三个md5是和谐文件返回的, 第一个是txt格式的"温馨提示.txt", 第二个是视频格式的（俗称5s）,第三个为新发现的8s视频文件
                    if (bad_md5.indexOf(file_md5) !== -1 || r.finalUrl.indexOf('issuecdn.baidupcs.com') !== -1) {
                        file_info.errno = 1919;
                    } else {
                        var spark = new SparkMD5.ArrayBuffer();
                        spark.append(r.response);
                        var slice_md5 = spark.end();
                        file_info.md5 = file_md5;
                        file_info.md5s = slice_md5;
                    }
                    gen_prog.textContent = '100%';
                    setTimeout(function () {
                        myGenerater(file_id + 1);
                    }, interval_mode ? interval * 1000 : 1000);
                } else {
                    console.log(`return #403, appid: ${appid_list[appid_id]}`);
                    if (r.status == 403 && appid_id < (appid_list.length - 1)) {
                        myGenerater(file_id, appid_id + 1, true);
                    } else {
                        file_info.errno = r.status;
                        myGenerater(file_id + 1);
                    }
                }
            }
        };
        xmlhttpRequest = GM_xmlhttpRequest(get_dl_par);
    }

    function try_get_md5(file_id, file_date) {
        var file_info = file_info_list[file_id];
        var get_dl_par = {
            url: meta_url + encodeURIComponent(file_info.path),
            type: 'GET',
            onload: function (r) {
                var file_md5 = r.responseText.match(/"block_list":\["([\da-f]{32})"\]/i) || r.responseText.match(/md5":"([\da-f]{32})"/i)
                if (file_md5) {
                    file_info.md5 = file_md5[1].toLowerCase();
                    var spark = new SparkMD5.ArrayBuffer();
                    spark.append(file_date);
                    file_info.md5s = spark.end();
                } else {
                    file_info.errno = 996;
                }
                myGenerater(file_id + 1);
            }
        }
        GM_xmlhttpRequest(get_dl_par);
    }

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
            return z.trim().match(/-length=([\d]{1,20}) -md5=([\dA-Fa-f]{32}) -slicemd5=([\dA-Fa-f]{32})[\s\S]+"([\s\S]+)"/)
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
                title: `${check_mode ? '测试' : '转存'}完毕 共${codeInfo.length}个 失败${failed}个!`,
                confirmButtonText: check_mode ? '复制秒传代码' : '确定',
                showCloseButton: true,
                ...(check_mode && checkbox_par),
                onBeforeOpen: () => {
                    var content = Swal.getContent();
                    codeInfo.forEach(function (item) {
                        if (item.hasOwnProperty('errno')) {
                            var file_name = item.path;
                            if (item.errno === 2 && item.size > 21474836480) {
                                item.errno = 3939;
                            }
                            var errText = checkErrno(item.errno, item.size);
                            var str1 = `文件：${file_name}`;
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
                    Add_content(document.createElement('div'));
                    var _dir = (dir || '').replace(/\/$/, '');
                    if (_dir) {
                        if (_dir.charAt(0) !== '/') {
                            _dir = '/' + _dir;
                        }
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
                    GM_deleteValue('unfinish');
                    interval_mode = false;
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
            url: `/api/rapidupload${check_mode ? '?rtype=3' : ''}`,
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
                    if (file.path.match(/["\\\:*?<>|]/)) {
                        codeInfo[i].errno = 2333;
                    } else {
                        codeInfo[i].errno = r.errno;
                    }
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
                saveFile(i, true)
            } else {
                saveFile(i + 1, false);
            }
        });
    }

    function checkErrno(errno, file_size = 0) {
        switch (errno) {
            case -7:
                return '保存路径存在非法字符';
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
                return `秒传不支持大于20G的文件,文件大小:${(file_size / (1024 ** 3)).toFixed(2)}G`;
                //文件大于20G时访问秒传接口实际会返回#2
            case 2333:
                return '链接内的文件路径错误(不能含有以下字符"\\:*?<>|)';
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

    function GetInfo(str = '') {
        Swal.fire({
            title: '请输入提取码',
            input: 'textarea',
            inputValue: str,
            showCancelButton: true,
            inputPlaceholder: '[支持 PanDL/梦姬标准/游侠/PCS-Go][支持批量]\n[输入setting进入设置页]',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputValidator: (value) => {
                if (!value) {
                    return '链接不能为空';
                }
                if (value === 'setting') {
                    return;
                }
                codeInfo = DuParser.parse(value);
                if (!codeInfo.length) {
                    return '未识别到正确的链接';
                }
            }
        }).then((result) => {
            if (!result.dismiss) {
                if (result.value === 'setting') {
                    setting();
                } else {
                    Process();
                }
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
                inputPlaceholder: '格式示例：/GTA5/, 默认保存在根目录',
                inputValue: dir,
                showCancelButton: true,
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                inputValidator: (value) => {
                    if (value.match(/["\\\:*?<>|]/)) {
                        return '路径中不能含有以下字符"\\:*?<>|, 格式示例：/GTA5/';
                    }
                }
            }).then((result) => {
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
            title: `文件${check_mode ? '测试' : '提取'}中`,
            html: `正在${check_mode ? '测试' : '转存'}第 <file_num></file_num> 个`,
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
        let bdlink = location.href.match(/[\?#]bdlink=([\da-zA-Z/\+]+)&?/);
        if (bdlink) {
            bdlink = bdlink[1].fromBase64();
        }
        return bdlink;
    }

    function Add_content(content) {
        var hasAdd = false;
        if (!GM_getValue('kill_feedback')) {
            hasAdd = true;
            content.innerHTML += `<p><br></p>`;
            content.innerHTML += html_feedback;
            let loop = setInterval(() => {
                var html_tag = $('#kill_feedback');
                if (!html_tag.length) return false;
                $('#kill_feedback').click(function () {
                    GM_setValue('kill_feedback', true);
                    $('#bdcode_feedback').remove();
                });
                clearInterval(loop);
            }, 50);
        }
        if (!GM_getValue('kill_donate')) {
            if (!hasAdd) {
                content.innerHTML += `<p><br></p>`;
            }
            content.innerHTML += html_donate;
            let loop = setInterval(() => {
                var html_tag = $('#kill_donate');
                if (!html_tag.length) return false;
                $('#kill_donate').click(function () {
                    GM_setValue('kill_donate', true);
                    $('#bdcode_donate').remove();
                });
                clearInterval(loop);
            }, 50);
        }
        Swal.getContent().appendChild(content);
    }

    function checkVipType() {
        var info_par = {
            url: info_url,
            type: 'GET',
            responseType: 'json',
            onload: function (r) {
                if (r.response.hasOwnProperty('vip_type')) {
                    vip_type = r.response.vip_type;
                }
            }
        };
        GM_xmlhttpRequest(info_par);
    }

    const injectStyle = () => {
        let style = GM_getResourceText('sweetalert2Css');
        // 暴力猴直接粘贴脚本代码时可能不会将resource中的数据下载缓存，fallback到下载css代码
        let themes = GM_getValue('Themes') || 'Minimal';
        console.log(themes);
        let css_code = GM_getValue(themes);
        if (css_code) {
            GM_addStyle(css_code);
            return;
        }
        if (style && themes === 'Minimal') {
            GM_setValue(themes, style);
            GM_addStyle(style);
            return;
        }
        GM_xmlhttpRequest({
            url: css_url[themes],
            type: 'GET',
            responseType: 'text',
            onload: function (r) {
                style = r.response;
                GM_setValue(themes, style);
                GM_addStyle(style);
            },
            onerror: function (r) {
                alert('秒传链接提取:\n外部资源加载失败, 脚本无法运行, 请检查网络或尝试更换DNS');
            }
        })
    };

    const showUpdateInfo = () => {
        if (!GM_getValue('1.5.4_no_first')) {
            Swal.fire({
                title: `秒传链接提取 1.5.4 更新内容(21.2.11):`,
                html: update_info,
                heightAuto: false,
                scrollbarPadding: false,
                showCloseButton: true,
                allowOutsideClick: false,
                confirmButtonText: '确定'
            }).then((result) => {
                GM_setValue('1.5.4_no_first', true);
            });
        }
    };

    function myInit() {
        injectStyle();
        const bdlink = GetInfo_url();
        window.addEventListener('DOMContentLoaded', () => {
            bdlink ? GetInfo(bdlink) : showUpdateInfo();
            initButtonHome();
            initButtonGen();
            checkVipType();
        });
    }

    function setting() {
        Swal.fire({
            title: '秒传链接提取 设置页',
            showCloseButton: true,
            showCancelButton: true,
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            allowOutsideClick: false,
            input: 'select',
            inputValue: GM_getValue('Themes') || 'Minimal',
            inputOptions: {
                'Minimal': 'Minimal 白色主题(默认)',
                'Bulma': 'Bulma 白色简约',
                'Bootstrap 4': 'Bootstrap4 白色简约',
                'Material UI': 'MaterialUI 白色主题',
                'Dark': 'Dark 黑色主题',
                'WordPress Admin': 'WordPressAdmin 灰色主题'
            }
        }).then((result) => {
            if (!result.dismiss) {
                GM_setValue('Themes', result.value);
                Swal.fire({
                    title: '设置成功 刷新页面生效',
                    showCloseButton: true,
                    allowOutsideClick: false,
                    html: csd_hint_html
                });
            }
        });
    }

    const update_info =
        `<div class="panel-body" style="height: 250px; overflow-y:scroll">
        <div style="border: 1px  #000000; width: 100%; margin: 0 auto;"><span>

        <p>面向分享者的 <a href="https://shimo.im/docs/TZ1JJuEjOM0wnFDH" rel="noopener noreferrer" target="_blank">防爆教程</a> 的防和谐方法更新:</p>

        <p>经测试, 原教程的 "固实压缩+加密文件名" 已无法再防和谐(在度盘移动端依旧可以在线解压), 目前有效的防和谐方法请参考教程内的 <span style="color: red;">"双层压缩"</span></p>
        
        <p><br></p>

        <p>若出现任何问题请前往<a href="https://greasyfork.org/zh-CN/scripts/397324" rel="noopener noreferrer" target="_blank">greasyfork页</a>反馈</p>

        <p><br></p>
        
        <p>1.4.3 更新内容(21.2.6):</p>

        <p>修复了生成秒传时, 秒传有效, 仍提示"md5获取失败(#996)"的问题</p>

        <p><br></p>
        
        <p>1.4.9 更新内容(21.1.28):</p>
        
        <p>1. 重新兼容了暴力猴插件, 感谢Trendymen提供的代码</p>

        <p>2. 新增更换主题的功能, 在秒传输入框中输入setting进入设置页, 更换为其他主题, 即可避免弹窗时的背景变暗</p>

        <p>3. 修改了部分代码逻辑, 秒传按钮不会再出现在最左边了</p>

        <p><br></p>

        <p>1.4.6 更新内容(21.1.14):</p>

        <p>本次更新针对生成功能做了优化:</p>

        <p>1. 使用超会账号进行10个以上的批量秒传生成时, 会弹窗提示设置生成间隔, 防止生成过快导致接口被限制(#403)</p>

        <p>2. 为秒传分享者提供了一份<a href="https://shimo.im/docs/TZ1JJuEjOM0wnFDH" rel="noopener noreferrer" target="_blank">防爆教程</a>用于参考</p>

        <p><br></p>

        <p>1.4.5 更新内容(21.1.12):</p>

        <p>修复了1.4.0后可能出现的秒传按钮无效、显示多个秒传按钮的问题</p>

        <p><br></p>

        <p>1.3.7 更新内容(21.1.3):</p>

        <p>修复了会员账号生成50M以下文件时提示 "md5获取失败" 的问题</p>

        <p><br></p>

        <p>1.3.3 更新内容(20.12.1):</p>

        <p>秒传生成完成后点击复制按钮之前都可以继续任务,防止误操作关闭页面导致生成结果丢失</p>

        <p>修改代码执行顺序防止秒传按钮出现在最左端</p>

        <p>修复了跨域提示中失效的说明图片</p>

        <p><br></p>

        <p>1.2.9 更新内容(20.11.11):</p>
        
        <p>生成秒传的弹窗添加了关闭按钮</p>
        
        <p>删除了全部生成失败时的复制和测试按钮</p>

        <p>秒传生成后加了一个导出文件路径的选项(默认不导出)</p>

        <p>在输入保存路径的弹窗添加了校验, 防止输入错误路径</p>

        <p><br></p>

        <p>1.2.5 更新内容(20.11.4):</p>
        
        <p>优化按钮样式, 添加了md5获取失败的报错</p>

        <p>修复从pan.baidu.com进入后不显示生成按钮的问题</p>
        
        <p><br></p>
        
        <p>1.2.4 更新内容(20.11.2):</p>
        
        <p>新增生成秒传:</p>
        
        <p>选择文件或文件夹后点击 "生成秒传" 即可开始生成</p>
        
        <p><br></p>
        
        <p>继续未完成任务:</p>
        
        <p>若生成秒传期间关闭了网页, 再次点击 "生成秒传" 即可继续任务</p>
        
        <p><br></p>
        
        <p>测试秒传功能:</p>
        
        <p>生成完成后, 点击"测试"按钮, 会自动转存并覆盖文件(文件内容不变), 以检测秒传有效性, 以及修复md5错误防止秒传失效</p>
        
        </span></div></div>`;

    myInit();
}();