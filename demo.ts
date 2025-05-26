import {markdownToBlocks} from './src/index';

const markdownContent = `
Here is a demo of a Markdown document that will be converted to Slack Block Kit blocks.:

---

## **Demo Header Before Unordered List**

- **Demo Unordered List:**
  **Multi-line and bold work too**
  Some text underneath that has no formatting.

- **Another Unordered List Element:**
    - This is a nested unordered list inside an unordered list.
    - It can also contain **bold text**, _italic text_, ~~strikethrough~~, and \`inline code\`.
    - Here is a [link](https://example.com) to a website.

- **Yet Another Unordered List Element:**
    - This is a nested unordered list inside an unordered list.
        - This is a double nested unordered list inside a nested unordered list.
        - It can also contain **bold text**, _italic text_, ~~strikethrough~~, and \`inline code\`.

---

### **Demo Header Before Ordered List**

1. **Ordered List Element One:**
    - Can be nested with unordered lists
    - As you can see, this is another nested unordered list element.

2. **Ordered List Element Two:**
    - It is possible to have multiple paragraphs in a list item.
      A paragraph can be split into multiple lines.
    - It can also contain **bold text**, _italic text_, ~~strikethrough~~, and \`inline code\`.
    - Here is a [link](https://example.com) to a website.
        - This is a double nested unordered list inside a nested ordered list.
        - It can also contain **bold text**, _italic text_, ~~strikethrough~~, and \`inline code\`.

3. **Ordered List Element Three:**
    1. This is a nested ordered list inside an ordered list.
    2. It can also contain **bold text**, _italic text_, ~~strikethrough~~, and \`inline code\`.
    3. Here is a [link](https://example.com) to a website.
        1. This is a double nested ordered list inside a nested ordered list.
        2. It can also contain **bold text**, _italic text_, ~~strikethrough~~, and \`inline code\`.

---

Here is some text next to a random image ![some random image](https://picsum.photos/200) and then some more text.

_Demo Rich Text Test:_
This is a bunch of text under an italic header.
This is a paragraph with *italic* text, **bold** text, ~~strikethrough~~ text, and \`inline code\`. Here is a [link](https://example.com).
`.trim();

const blocks = markdownToBlocks(markdownContent, {
  useRichText: true,
});
console.log(JSON.stringify(blocks, null, 2));
