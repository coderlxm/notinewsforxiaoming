<script setup lang="ts">
import type { ContributionSuccessResult } from '../../composables/useContributionSubmit';

defineProps<{
  result: ContributionSuccessResult;
}>();

const emit = defineEmits<{
  restart: [];
}>();
</script>

<template>
  <section class="contribution-card contribution-success" aria-live="assertive">
    <div class="contribution-success__mark" aria-hidden="true">✓</div>
    <p class="contribution-success__eyebrow">投稿已送达</p>
    <h2>已经送到小明</h2>
    <p class="contribution-success__description">
      谢谢你，{{ result.senderName }}。小明会亲自查看这份内容。
    </p>
    <dl class="contribution-success__details">
      <div>
        <dt>素材</dt>
        <dd>{{ result.assetCount }} 项</dd>
      </div>
      <div>
        <dt>送达时间</dt>
        <dd>
          {{ new Date(result.submittedAt).toLocaleString('zh-CN', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) }}
        </dd>
      </div>
    </dl>
    <button class="contribution-secondary-button" type="button" @click="emit('restart')">
      再送一份
    </button>
  </section>
</template>
