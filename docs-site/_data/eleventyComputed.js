// Applied to every Markdown file during rendering unless overridden in
// frontmatter.
//
// - layout: use the "page" layout (default content + TOC sidebar) for every
//   rendered Markdown page.
// - permalink: compute a pretty URL from the file path.
//     * root README.md           -> /
//     * any other README.md      -> directory index (/path/)
//     * everything else          -> /path/filename/
// - title: fall back to the file slug when no frontmatter title is set, so
//   the HTML <title> and page-title partial always have something to show.

module.exports = {
  layout: (data) => data.layout || 'page',

  permalink: (data) => {
    if (data.permalink !== undefined) return data.permalink;

    const inputPath = data.page.inputPath || '';
    // Normalise: strip leading "./" and the trailing ".md".
    let p = inputPath.replace(/^(\.\.\/|\.\/)+/, '').replace(/\.md$/, '');

    if (p === 'README') return '/';
    if (p.endsWith('/README')) return '/' + p.slice(0, -'/README'.length) + '/';
    return '/' + p + '/';
  },

  title: (data) => {
    if (data.title) return data.title;
    // Filename-based fallback; humans can override via frontmatter.
    const slug = (data.page && data.page.fileSlug) || '';
    if (!slug || slug === 'README') return data.site && data.site.title ? data.site.title : 'Home';
    return slug;
  }
};
