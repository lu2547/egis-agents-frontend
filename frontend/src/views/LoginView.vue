<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const loginMode = ref<'startup' | 'um'>('startup');
const account = ref('');
const password = ref('');
const agreed = ref(true);

const accountLabel = computed(() => (loginMode.value === 'startup' ? '开机账号' : 'UM账号'));
const canSubmit = computed(() => {
  return agreed.value && account.value.trim().length > 0 && password.value.trim().length > 0;
});

const submitLogin = () => {
  if (!canSubmit.value) return;
  router.push('/');
};
</script>

<template>
  <section class="login-page">
    <main class="login-wrap">
      <section class="login-panel">
        <aside class="brand-side">
          <div class="brand-name">智颐通</div>

          <div class="welcome-copy">
            <h1>欢迎使用养老险GPT</h1>
            <p>你的智能伙伴</p>
          </div>

          <div class="visual-orbit" aria-hidden="true">
            <div class="orbit-ring ring-a"></div>
            <div class="orbit-ring ring-b"></div>
            <div class="data-stage">
              <span class="paper paper-a"></span>
              <span class="paper paper-b"></span>
              <span class="paper paper-c"></span>
              <span class="spark spark-a"></span>
              <span class="spark spark-b"></span>
              <span class="dot dot-a"></span>
              <span class="dot dot-b"></span>
            </div>
          </div>

          <p class="contact"></p>
        </aside>

        <section class="form-side" aria-label="登录">
          <div class="login-tabs">
            <button type="button" :class="{ active: loginMode === 'startup' }" @click="loginMode = 'startup'">
              开机账号
            </button>
            <button type="button" :class="{ active: loginMode === 'um' }" @click="loginMode = 'um'">UM账号</button>
          </div>

          <div class="form-group">
            <label>{{ accountLabel }}</label>
            <input v-model="account" class="text-field" type="text" :placeholder="`请输入${accountLabel}`" />
          </div>

          <div class="form-group">
            <label>
              <span>密码</span>
              <a href="#">找回密码</a>
            </label>
            <input v-model="password" class="text-field" type="password" placeholder="请输入密码" />
          </div>

          <button type="button" class="login-submit" :disabled="!canSubmit" @click="submitLogin">登录</button>

          
        </section>
      </section>

      <p class="login-footer">
        养老险GPT提供智能信息服务，致力于为业务团队提供前瞻、深度、精准的知识检索和决策支撑。
      </p>
    </main>
  </section>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(28px, 5vh, 54px) 24px;
  color: #1f2433;
  background:
    radial-gradient(circle at 78% 16%, rgba(70, 111, 255, 0.12), transparent 30%),
    linear-gradient(135deg, #f4f8ff 0%, #edf4ff 54%, #f8fbff 100%);
}

.login-wrap {
  width: min(760px, 100%);
}

.login-panel {
  min-height: 430px;
  display: grid;
  grid-template-columns: minmax(310px, 334px) minmax(380px, 1fr);
  overflow: hidden;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 22px 72px rgba(42, 76, 137, 0.14);
}

.brand-side {
  position: relative;
  min-height: 430px;
  padding: 22px 26px 18px;
  overflow: hidden;
  color: #ffffff;
  background:
    radial-gradient(circle at 62% 35%, rgba(255, 255, 255, 0.2), transparent 34%),
    linear-gradient(145deg, #3765f3 0%, #6aa0ff 100%);
}

.brand-name {
  font-size: 19px;
  font-weight: 900;
  letter-spacing: 0;
}

.welcome-copy {
  margin-top: 50px;
  text-align: center;
}

.welcome-copy h1 {
  margin: 0;
  font-size: clamp(25px, 2.2vw, 31px);
  line-height: 1.18;
  font-weight: 900;
  letter-spacing: 0;
}

.welcome-copy p {
  margin: 10px 0 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 4px;
}

.visual-orbit {
  position: relative;
  width: min(236px, 72%);
  aspect-ratio: 1;
  margin: 30px auto 0;
}

.orbit-ring {
  position: absolute;
  left: 50%;
  width: 62%;
  height: 22px;
  border: 3px solid rgba(180, 211, 255, 0.24);
  border-radius: 50%;
  transform: translateX(-50%) rotate(-4deg);
}

.ring-a {
  bottom: 24px;
}

.ring-b {
  bottom: 48px;
  width: 78%;
  opacity: 0.85;
}

.data-stage {
  position: absolute;
  inset: 0;
}

.data-stage::before {
  content: "";
  position: absolute;
  left: 31%;
  right: 31%;
  bottom: 52px;
  height: 38px;
  border-radius: 50% 50% 10px 10px;
  background: rgba(234, 243, 255, 0.92);
  box-shadow: inset 0 -18px 0 rgba(92, 137, 244, 0.28);
}

.paper {
  position: absolute;
  width: 54px;
  height: 38px;
  border-radius: 5px;
  background: rgba(230, 242, 255, 0.92);
  box-shadow: 0 12px 18px rgba(33, 74, 178, 0.12);
}

.paper::before,
.paper::after {
  content: "";
  position: absolute;
  left: 14px;
  right: 14px;
  height: 2px;
  border-radius: 2px;
  background: rgba(69, 110, 232, 0.38);
}

.paper::before {
  top: 12px;
}

.paper::after {
  top: 22px;
}

.paper-a {
  left: 28px;
  top: 38px;
  transform: rotate(-12deg);
}

.paper-b {
  right: 26px;
  top: 36px;
  transform: rotate(10deg);
}

.paper-c {
  left: 38px;
  bottom: 64px;
  transform: rotate(-18deg);
}

.spark,
.dot {
  position: absolute;
  display: block;
  background: rgba(255, 255, 255, 0.9);
}

.spark {
  width: 12px;
  height: 12px;
  clip-path: polygon(50% 0, 60% 39%, 100% 50%, 60% 61%, 50% 100%, 40% 61%, 0 50%, 40% 39%);
}

.spark-a {
  right: 40px;
  top: 24px;
}

.spark-b {
  left: 28px;
  bottom: 50px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot-a {
  left: 64px;
  top: 22px;
}

.dot-b {
  right: 62px;
  bottom: 22px;
}

.contact {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 22px;
  margin: 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  text-align: center;
}

.form-side {
  width: min(246px, calc(100% - 64px));
  align-self: center;
  justify-self: center;
  padding: 38px 0;
}

.login-tabs {
  height: 30px;
  margin-bottom: 20px;
  display: flex;
  align-items: flex-end;
  gap: 32px;
}

.login-tabs button {
  position: relative;
  padding: 0 0 10px;
  border: 0;
  color: #555c6a;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.login-tabs button.active {
  color: #3864ef;
  font-weight: 800;
}

.login-tabs button.active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: #3864ef;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  min-height: 22px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #202633;
  font-size: 12px;
  font-weight: 600;
}

.form-group label a,
.agreement a {
  color: #3864ef;
  text-decoration: none;
}

.text-field {
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: 0;
  color: #202838;
  background: #f2f4f7;
  font-size: 12px;
}

.text-field:focus {
  border-color: #3864ef;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(56, 100, 239, 0.08);
}

.login-submit,
.apply-button {
  width: 100%;
  height: 32px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 800;
}

.login-submit {
  margin-top: 8px;
  border: 0;
  color: #ffffff;
  background: #3864ef;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.login-submit:disabled {
  cursor: not-allowed;
  opacity: 0.28;
}

.login-submit:not(:disabled):hover {
  transform: translateY(-1px);
}

.apply-button {
  margin-top: 12px;
  border: 1px solid #3864ef;
  color: #3864ef;
  background: #ffffff;
}

.agreement {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 8px;
  color: #576376;
  font-size: 11px;
  line-height: 1.65;
}

.agreement input {
  width: 14px;
  height: 14px;
  margin: 4px 0 0;
  accent-color: #3864ef;
}

.login-footer {
  width: calc(100% - 48px);
  margin: 16px auto 0;
  color: #8b94a6;
  font-size: 13px;
  line-height: 1.8;
}

@media (max-width: 980px) {
  .login-page {
    align-items: flex-start;
    padding: 28px 18px;
  }

  .login-panel {
    min-height: 0;
    grid-template-columns: 1fr;
    border-radius: 10px;
  }

  .brand-side {
    min-height: 430px;
    padding: 28px 30px 22px;
  }

  .welcome-copy {
    margin-top: 34px;
  }

  .visual-orbit {
    width: min(300px, 70%);
    margin-top: 24px;
  }

  .form-side {
    width: min(440px, calc(100% - 48px));
    padding: 42px 0 44px;
  }
}

@media (max-width: 560px) {
  .login-page {
    padding: 24px 0;
    align-items: flex-start;
  }

  .login-wrap {
    width: min(420px, calc(100vw - 64px));
  }

  .login-panel {
    min-height: auto;
    border-radius: 10px;
  }

  .brand-side {
    min-height: 286px;
    padding: 20px 22px 16px;
  }

  .brand-name {
    font-size: 19px;
  }

  .welcome-copy {
    margin-top: 18px;
  }

  .welcome-copy h1 {
    font-size: 22px;
  }

  .welcome-copy p {
    margin-top: 10px;
    font-size: 14px;
  }

  .visual-orbit {
    width: 180px;
    margin-top: 14px;
  }

  .data-stage {
    transform: scale(0.72);
    transform-origin: center center;
  }

  .contact {
    bottom: 14px;
    font-size: 13px;
  }

  .form-side {
    width: calc(100% - 40px);
    padding: 24px 0 26px;
  }

  .login-tabs {
    height: 34px;
    margin-bottom: 16px;
  }

  .login-tabs button {
    font-size: 13px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-group label {
    font-size: 13px;
  }

  .text-field {
    height: 38px;
    font-size: 13px;
  }

  .login-submit,
  .apply-button {
    height: 38px;
    font-size: 14px;
  }

  .agreement {
    margin-top: 12px;
    font-size: 12px;
  }

  .login-footer {
    display: none;
  }
}
</style>
