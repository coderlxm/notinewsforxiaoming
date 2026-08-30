<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, shallowRef } from 'vue';
import type {
  GameEditorSubmission,
  GameItem,
  GamePlatform,
  GamePlayStatus,
} from './gameTypes';

const props = withDefaults(defineProps<{
  game?: GameItem | null;
  submitting?: boolean;
}>(), {
  game: null,
  submitting: false,
});

const emit = defineEmits<{
  close: [];
  save: [submission: GameEditorSubmission];
}>();

const form = reactive({
  title: props.game?.title ?? '',
  originalTitle: props.game?.originalTitle ?? '',
  coverUrl: props.game?.coverUrl ?? '',
  bannerUrl: props.game?.bannerUrl ?? '',
  platform: props.game?.platforms[0] ?? 'PS5' as GamePlatform,
  genre: props.game?.genre.join(', ') ?? '',
  developer: props.game?.developer ?? '',
  releaseYear: props.game?.releaseYear ?? new Date().getFullYear(),
  status: props.game?.status ?? 'completed' as GamePlayStatus,
  completedAt: props.game?.completedAt ?? new Date().toISOString().split('T')[0],
  playtimeHours: props.game?.playtimeHours ?? 0,
  platinumTrophy: props.game?.platinumTrophy ?? false,
  isGoty: props.game?.isGoty ?? false,
  rating: props.game?.rating ?? 9,
  punchline: props.game?.punchline ?? '',
  pros: props.game?.pros.join('\n') ?? '',
  cons: props.game?.cons.join('\n') ?? '',
  reviewMarkdown: props.game?.reviewMarkdown ?? '',
});

const coverFile = shallowRef<File | null>(null);
const bannerFile = shallowRef<File | null>(null);
const screenshotFiles = shallowRef<File[]>([]);
const formError = shallowRef<string | null>(null);
const editing = computed(() => props.game !== null);

function selectedFile(event: Event): File | null {
  return (event.target as HTMLInputElement).files?.item(0) ?? null;
}

function selectCover(event: Event): void {
  coverFile.value = selectedFile(event);
  formError.value = null;
}

function selectBanner(event: Event): void {
  bannerFile.value = selectedFile(event);
}

function selectScreenshots(event: Event): void {
  screenshotFiles.value = Array.from((event.target as HTMLInputElement).files ?? []);
}

function handleSubmit(): void {
  if (!form.title.trim() || props.submitting) return;
  if (!form.coverUrl.trim() && coverFile.value === null) {
    formError.value = '请填写封面图片 URL 或选择本地封面图片。';
    return;
  }

  const rating = Number(form.rating);
  emit('save', {
    input: {
      title: form.title.trim(),
      originalTitle: form.originalTitle.trim(),
      coverUrl: form.coverUrl.trim(),
      bannerUrl: form.bannerUrl.trim(),
      platforms: props.game && props.game.platforms[0] === form.platform
        ? props.game.platforms
        : [form.platform],
      genre: form.genre.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      developer: form.developer.trim(),
      publisher: props.game?.publisher,
      releaseYear: Number(form.releaseYear),
      status: form.status,
      completedAt: form.completedAt || undefined,
      playtimeHours: Number(form.playtimeHours),
      difficulty: props.game?.difficulty,
      platinumTrophy: form.platinumTrophy,
      isGoty: form.isGoty,
      rating,
      verdictTitle: rating >= 9.5 ? 'MASTERPIECE' : rating >= 9 ? 'AMAZING' : 'GREAT',
      punchline: form.punchline.trim(),
      pros: form.pros.split('\n').map(s => s.trim()).filter(Boolean),
      cons: form.cons.split('\n').map(s => s.trim()).filter(Boolean),
      dimensionRatings: props.game?.dimensionRatings ?? {
        gameplay: rating,
        story: rating,
        visuals: rating,
        music: rating,
        performance: rating,
      },
      reviewMarkdown: form.reviewMarkdown.trim(),
      screenshots: props.game?.screenshots ?? [],
    },
    coverFile: coverFile.value,
    bannerFile: bannerFile.value,
    screenshotFiles: screenshotFiles.value,
  });
}

function close(): void {
  if (!props.submitting) emit('close');
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close();
}

let previousBodyOverflow = '';

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = previousBodyOverflow;
});
</script>

<template>
  <div class="modal-overlay" @click.self="close">
    <div class="add-modal">
      <div class="add-modal__header">
        <h2 class="add-modal__title">{{ editing ? '编辑游戏档案' : '录入通关游戏' }}</h2>
        <button type="button" class="close-btn" :disabled="submitting" @click="close">✕</button>
      </div>

      <form class="add-form" @submit.prevent="handleSubmit">
        <div class="form-row">
          <div class="form-group">
            <label>游戏中文名称 *</label>
            <input v-model="form.title" type="text" required placeholder="如：艾尔登法环" />
          </div>
          <div class="form-group">
            <label>英文原名</label>
            <input v-model="form.originalTitle" type="text" placeholder="如：Elden Ring" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>开发商</label>
            <input v-model="form.developer" type="text" placeholder="如：FromSoftware" />
          </div>
          <div class="form-group">
            <label>类型标签（逗号分隔）</label>
            <input v-model="form.genre" type="text" placeholder="如：ARPG, 开放世界" />
          </div>
          <div class="form-group">
            <label>发售年份</label>
            <input v-model.number="form.releaseYear" type="number" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>封面图片 URL</label>
            <input v-model="form.coverUrl" type="text" placeholder="也可在下方选择本地图片" />
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="selectCover" />
            <span v-if="coverFile" class="file-selection">已选择：{{ coverFile.name }}</span>
          </div>
          <div class="form-group">
            <label>背景横幅 URL</label>
            <input v-model="form.bannerUrl" type="text" placeholder="也可在下方选择本地图片" />
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="selectBanner" />
            <span v-if="bannerFile" class="file-selection">已选择：{{ bannerFile.name }}</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>通关平台</label>
            <select v-model="form.platform">
              <option value="PS5">PlayStation 5</option>
              <option value="PS4">PlayStation 4</option>
              <option value="PC">PC / Steam</option>
              <option value="Switch">Nintendo Switch</option>
              <option value="Xbox">Xbox Series X|S</option>
              <option value="iOS">iOS</option>
              <option value="Other">其他平台</option>
            </select>
          </div>

          <div class="form-group">
            <label>通关状态</label>
            <select v-model="form.status">
              <option value="completed">✓ 已通关</option>
              <option value="mastered">🏆 白金/100% 全成就</option>
              <option value="playing">🎮 正在游玩</option>
              <option value="shelved">封盘</option>
              <option value="backlog">待游玩</option>
            </select>
          </div>

          <div class="form-group">
            <label>游玩时长 (小时)</label>
            <input v-model.number="form.playtimeHours" type="number" min="0" />
          </div>

          <div class="form-group">
            <label>通关日期</label>
            <input v-model="form.completedAt" type="date" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>个人总评分 (0 - 10) *</label>
            <input v-model.number="form.rating" type="number" step="0.1" min="0" max="10" required />
          </div>

          <div class="form-group form-group--checkboxes">
            <label class="checkbox-label">
              <input v-model="form.platinumTrophy" type="checkbox" />
              <span>白金 / 全成就已达成</span>
            </label>
            <label class="checkbox-label">
              <input v-model="form.isGoty" type="checkbox" />
              <span>设为年度最佳 / 殿堂精选</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>一句话总评 (Punchline)</label>
          <input v-model="form.punchline" type="text" required placeholder="如：箱庭探索与开放世界的巅峰结合" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>优点 (每行一条)</label>
            <textarea v-model="form.pros" rows="3" placeholder="输入的优点列表..." />
          </div>
          <div class="form-group">
            <label>缺点 (每行一条)</label>
            <textarea v-model="form.cons" rows="3" placeholder="输入的缺点列表..." />
          </div>
        </div>

        <div class="form-group">
          <label>通关长评与感言 (Markdown)</label>
          <textarea v-model="form.reviewMarkdown" rows="4" placeholder="写下你的通关体验、难忘时刻..." />
        </div>

        <div class="form-group">
          <label>新增通关高光截图</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            @change="selectScreenshots"
          />
          <span v-if="screenshotFiles.length" class="file-selection">
            已选择 {{ screenshotFiles.length }} 张截图
          </span>
        </div>

        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <div class="add-modal__actions">
          <button type="button" class="btn btn--secondary" :disabled="submitting" @click="close">取消</button>
          <button type="submit" class="btn btn--primary" :disabled="submitting" :aria-busy="submitting">
            {{ submitting ? '正在保存…' : editing ? '保存档案修改' : '保存并加入成就墙' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1050;
  background: rgba(4, 6, 10, 0.8);
  backdrop-filter: blur(12px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
}

.add-modal {
  width: min(720px, 100%);
  max-height: 90vh;
  background: #0f131c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  padding: 1.75rem;
}

.add-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.add-modal__title {
  margin: 0;
  font-size: 1.25rem;
  color: #ffffff;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.25rem;
  cursor: pointer;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
  min-width: 160px;
}

.form-group label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 600;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group input[type="date"],
.form-group select,
.form-group textarea {
  padding: 0.55rem 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.85rem;
  outline: none;
  font-family: inherit;
}

.form-group input[type="file"] {
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.75rem;
}

.file-selection {
  color: #93c5fd;
  font-size: 0.72rem;
}

.form-error {
  margin: 0;
  color: #fca5a5;
  font-size: 0.8rem;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.25);
}

.form-group--checkboxes {
  justify-content: center;
  gap: 0.6rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}

.add-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn--secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}

.btn--primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.btn--primary:hover {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.btn:disabled {
  cursor: wait;
  opacity: 0.6;
}
</style>
