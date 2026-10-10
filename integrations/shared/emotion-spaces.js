export const EMOTION_SPACES = {
  anxious: {
    label: { zh: '焦虑', en: 'Anxious' }, color: '#9bbcc2',
    hint: { zh: '脑子停不下来，心里有些绷紧。', en: 'A busy mind, a little on edge.' },
    placeholder: { zh: '还有很多没发生的事，却已经开始担心了。', en: 'I am worrying about things that have not happened yet.' },
    encouragements: [
      { zh: '不用现在就想好所有答案。', en: 'You do not need every answer right now.' },
      { zh: '我们可以先陪这一刻慢一点。', en: 'We can take this moment slowly.' },
      { zh: '这份紧绷，我听见了。', en: 'I hear how tense this feels.' },
    ],
  },
  sad: {
    label: { zh: '难过', en: 'Sad' }, color: '#a6b5d0',
    hint: { zh: '有些委屈，也可能说不清为什么。', en: 'Something hurts, even without a clear reason.' },
    placeholder: { zh: '今天有点想哭，也说不清是为什么。', en: 'I feel like crying today, without knowing exactly why.' },
    encouragements: [
      { zh: '难过不需要先找到理由。', en: 'You do not need a reason to feel sad.' },
      { zh: '不用急着好起来，我在这里听。', en: 'No rush to feel better. I am listening.' },
      { zh: '今天可以对自己温柔一点。', en: 'You can be gentle with yourself today.' },
    ],
  },
  lonely: {
    label: { zh: '孤独', en: 'Lonely' }, color: '#c3b0c3',
    hint: { zh: '想被理解，又不知道从哪里说起。', en: 'Wanting to be understood, not knowing where to start.' },
    placeholder: { zh: '身边有很多人，可还是觉得只有自己。', en: 'There are people around me, but I still feel alone.' },
    encouragements: [
      { zh: '你的这句话，有人认真读到了。', en: 'Someone read your words with care.' },
      { zh: '我也有过这样的时刻。', en: 'I have felt something like this too.' },
      { zh: '不用说得很完整，也值得被听见。', en: 'Your words do not have to be perfect to matter.' },
    ],
  },
  tired: {
    label: { zh: '疲惫 / 低落', en: 'Tired / low' }, color: '#b7c2aa',
    hint: { zh: '没发生什么，却像已经用完了力气。', en: 'Not much happened, yet your energy feels spent.' },
    placeholder: { zh: '明明今天什么都没发生，但就是觉得特别累。', en: 'Nothing really happened today, but I feel so tired.' },
    encouragements: [
      { zh: '累了也不用证明自己有多努力。', en: 'You do not have to prove you worked hard to deserve rest.' },
      { zh: '今天先做到这里，也可以。', en: 'It is okay for this to be enough today.' },
      { zh: '休息不是落后。', en: 'Resting does not mean falling behind.' },
    ],
  },
  numb: {
    label: { zh: '说不清', en: 'Hard to name' }, color: '#b8b8b0',
    hint: { zh: '空空的，或者几种感觉混在一起。', en: 'Feeling empty, mixed, or somewhere in between.' },
    placeholder: { zh: '不知道自己怎么了，只想在这里待一会儿。', en: 'I do not know how I feel. I just want to stay a moment.' },
    encouragements: [
      { zh: '说不清也没关系。', en: 'It is okay not to have words for it.' },
      { zh: '不用勉强自己有某种感受。', en: 'You do not have to force yourself to feel a certain way.' },
      { zh: '在这里待一会儿就好。', en: 'It is okay to simply stay a while.' },
    ],
  },
  calm: {
    label: { zh: '平静 / 还不错', en: 'Calm / okay' }, color: '#d6b789',
    hint: { zh: '留住一点轻松，或把温柔递出去。', en: 'A little ease to keep or kindness to share.' },
    placeholder: { zh: '今天路上的风很舒服，想把这一刻留下来。', en: 'The breeze felt good today. I wanted to keep that moment.' },
    encouragements: [
      { zh: '谢谢你留下这个小小的瞬间。', en: 'Thank you for sharing this little moment.' },
      { zh: '看到这句话，我也轻松了一点。', en: 'Reading this gave me a little ease too.' },
      { zh: '愿这份平静陪你久一点。', en: 'May this calm stay with you a little longer.' },
    ],
  },
};

export const isEmotionSpace = (value) => typeof value === 'string' && Object.hasOwn(EMOTION_SPACES, value);
