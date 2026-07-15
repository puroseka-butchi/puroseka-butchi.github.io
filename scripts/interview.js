'use strict';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(content) {
  return hexo.render.renderSync({
    text: String(content || '').trim().replace(/([^\n])\n(?=[^\n])/g, '$1  \n'),
    engine: 'markdown'
  });
}

function normalizeQuestion(content) {
  return String(content || '').trim().replace(/^(?:[—–-]+\s*)+/, '');
}

hexo.extend.tag.register('interview_lead', function interviewLeadTag(args, content) {
  return `<div class="interview-lead">${renderMarkdown(content)}</div>`;
}, { ends: true });

hexo.extend.tag.register('interview_question', function interviewQuestionTag(args, content) {
  return `<section class="interview-question">
    <span class="interview-question__label">Câu hỏi</span>
    <div class="interview-question__body">${renderMarkdown(normalizeQuestion(content))}</div>
  </section>`;
}, { ends: true });

hexo.extend.tag.register('interview_answer', function interviewAnswerTag(args, content) {
  const speaker = args.join(' ').replace(/^(["'])(.*)\1$/, '$2') || 'Trả lời';
  return `<section class="interview-answer">
    <span class="interview-answer__speaker">${escapeHtml(speaker)}</span>
    <div class="interview-answer__body">${renderMarkdown(content)}</div>
  </section>`;
}, { ends: true });

hexo.extend.filter.register('after_post_render', function wrapInterviewArticle(data) {
  if (data.post_type !== 'interview' || !data.content || data.content.includes('class="interview-article"')) {
    return data;
  }

  data.content = `<div class="interview-article">${data.content}</div>`;
  return data;
});
