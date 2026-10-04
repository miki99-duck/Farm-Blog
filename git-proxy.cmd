@echo off
REM ============================================================
REM  GitHub 走本地代理的 git 包装脚本
REM
REM  背景：你的系统代理指向 127.0.0.1:7890（Clash 默认端口），
REM        浏览器/VSCode 会自动用它，但 git 不读 Windows 系统代理，
REM        直连 GitHub 会被间歇性切断（现象：ls-remote 偶尔通，
REM        push/fetch 一律 21 秒超时）。
REM
REM  实测：git config http.proxy 在这个环境里会在 TLS 阶段
REM        报 SSL_ERROR_SYSCALL，而设 HTTPS_PROXY 环境变量可以正常通过。
REM        所以这里用环境变量的方式，而不是写进 git config。
REM
REM  用法：本文件放在仓库根，执行过一次 install 之后，
REM        以后直接 git push / git fetch 即可。
REM
REM  换代理端口：改下面两行的 7890。
REM  卸载：git config --local --unset core.gitProxy
REM ============================================================

set "HTTPS_PROXY=http://127.0.0.1:7890"
set "HTTP_PROXY=http://127.0.0.1:7890"

REM 转发所有参数给真正的 git
git.exe %*
