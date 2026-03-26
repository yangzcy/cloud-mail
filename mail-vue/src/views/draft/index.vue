<template>
  <emailScroll ref="scroll"
               :allow-star="false"
               :getEmailList="getEmailList"
               :emailDelete="emailDelete"
               :star-add="starAdd"
               :star-cancel="starCancel"
               @jump="jumpContent"
               actionLeft="6px"
               :show-account-icon="false"
               :show-first-loading="false"
               :showStar="false"
               @delete-draft="deleteDraft"
               :type="'draft'"
  >
    <template #name="props">
      <span class="send-email">{{ props.email.receiveEmail?.join(',') || '(' + $t('noRecipient') + ')' }}</span>
    </template>
    <template #subject="props">
      {{ props.email.subject || '(' + $t('noSubject') + ')' }}
    </template>
  </emailScroll>
</template>

<script setup>
import emailScroll from "@/components/email-scroll/index.vue"
import {emailDelete} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {defineOptions, ref, watch, toRaw} from "vue";
import {useUiStore} from "@/store/ui.js";
import {userDraftStore} from "@/store/draft.js";
import db from "@/db/db.js"

defineOptions({
  name: 'draft'
})

const draftStore = userDraftStore();
const uiStore = useUiStore();
const scroll = ref({})

watch(() => draftStore.setDraft, async () => {

  const draft = toRaw(draftStore.setDraft)
  const draftId = draft.draftId
  const attachments = toRaw(draftStore.setDraft.attachments)

  delete draft.draftId
  delete draft.attachments

  // 草稿编辑窗口关闭时会把最新内容回写到 store，这里统一同步到 IndexedDB。
  if (!draft.content && !draft.subject && !(draft.receiveEmail.length > 0)) {
    await db.value.draft.delete(draftId);
    await db.value.att.delete(draftId);
    draftStore.refreshList++
    return;
  }

  await db.value.draft.update(draftId, draft);
  await db.value.att.update(draftId, {attachments: attachments});
  draftStore.refreshList++
}, {
  deep: true
})

watch(() => draftStore.refreshList, async () => {
  // 通过 refreshList 这个信号驱动草稿列表重载，避免在多个组件间直接互相调用。
  const {list} = await getEmailList();
    scroll.value.emailList.length = 0
    scroll.value.handleList(list);
    scroll.value.emailList.push(...list)
})

function getEmailList() {
  return new Promise((resolve, reject) => {
    db.value.draft.orderBy('createTime').reverse().toArray().then(list => {
      resolve({list})
    })
  })
}

async function deleteDraft(draftIds) {
  await db.value.draft.bulkDelete(draftIds);
  draftStore.refreshList++
}

async function jumpContent(email) {
  // 草稿正文和附件分表存储，重新打开时需要把附件补回到写信表单。
  const att = await db.value.att.get(email.draftId)
  email.attachments = att.attachments
  uiStore.writerRef.openDraft(email);
}

</script>
<style>
.send-email {
  font-weight: normal;
}
</style>
