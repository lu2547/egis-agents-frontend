/** 平台检测与快捷键提示（macOS: ⌘Enter；Windows/Linux: Ctrl+Enter）。 */

/** 是否 macOS（Command 键宿主；navigator.platform 已废弃但兼容性最广）。 */
export const IS_MAC =
    /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent);

/** 发送快捷键提示文案（composer 尾注 / placeholder 共用）。 */
export const SEND_SHORTCUT_HINT = IS_MAC ? '⌘ Enter 发送' : 'Ctrl + Enter 发送';
