/**
 * [aiti] 宿主能力表 —— 按宿主声明哪些上游载体子系统可用。
 *
 * 原则（fork 改造纪律）：
 *   - pi 宿主（上游）：全部 true，行为与上游完全一致。
 *   - pi-web 宿主：TUI/斜杠/watchdog/intercom/集成 关闭（pi-web 有自己的 Fleet Web 面板
 *     与消息渲染管线）；core 引擎面（runs/agents/shared/api）不受 caps 影响、恒可用。
 *   - caps 只做「屏蔽判定」，绝不改变引擎行为——上游测试 test:unit 必须在两种 caps 下同绿。
 */
import { detectHost, type AitiHost } from "./detect.ts";

export interface HostCaps {
	/** TUI 渲染（render.ts 组件、Fleet 状态栏、widget） */
	tui: boolean;
	/** 斜杠命令 UI（slash-commands 的交互面；事件桥 prompt-template 不属此项） */
	slash: boolean;
	/** watchdog TUI 看门狗 UI */
	watchdog: boolean;
	/** intercom 监督者通道 UI */
	intercom: boolean;
	/** herdr 等外部集成 */
	integrations: boolean;
	/** async-job-tracker 的状态 widget 渲染（hasUI 门控之外的第二道闸） */
	widget: boolean;
}

export const PI_HOST_CAPS: HostCaps = {
	tui: true,
	slash: true,
	watchdog: true,
	intercom: true,
	integrations: true,
	widget: true,
};

export const PI_WEB_HOST_CAPS: HostCaps = {
	tui: false,
	slash: false,
	watchdog: false,
	intercom: false,
	integrations: false,
	widget: false,
};

export function resolveHostCaps(host: AitiHost = detectHost()): HostCaps {
	return host === "pi-web" ? PI_WEB_HOST_CAPS : PI_HOST_CAPS;
}
