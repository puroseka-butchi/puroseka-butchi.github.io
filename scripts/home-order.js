'use strict';

function manualOrder(value) {
  const order = Number(value);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function manualGroup(value) {
  return Number.isFinite(Number(value)) ? 1 : 0;
}

hexo.config.index_generator = Object.assign({}, hexo.config.index_generator, {
  order_by: '+home_order_group +home_order_sort -date'
});

hexo.extend.filter.register('after_post_render', data => {
  data.home_order_group = manualGroup(data.home_order);
  data.home_order_sort = manualOrder(data.home_order);
  return data;
});

hexo.extend.filter.register('before_generate', () => {
  const posts = hexo.locals.get('posts');
  const list = posts && typeof posts.toArray === 'function' ? posts.toArray() : [];
  for (const post of list) {
    post.home_order_group = manualGroup(post.home_order);
    post.home_order_sort = manualOrder(post.home_order);
  }
});
