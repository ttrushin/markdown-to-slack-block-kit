import {parseBlocks} from '../src/parser/internal';
import {marked} from 'marked';
import {
  RichTextBlock,
  RichTextList,
  RichTextSection,
  RichTextText,
  RichTextLink,
  SectionBlock,
} from '@slack/types';

describe('rich text lists', () => {
  it('should parse unordered lists as rich text blocks', () => {
    const tokens = marked.lexer(
      `
- First item
- Second item
- Third item
    `.trim(),
    );

    const actual = parseBlocks(tokens, {lists: {useRichText: true}});

    expect(actual).toHaveLength(1);
    expect(actual[0].type).toBe('rich_text');

    const richTextBlock = actual[0] as RichTextBlock;
    expect(richTextBlock.elements).toHaveLength(3);

    // Check first list item
    const firstItem = richTextBlock.elements[0] as RichTextList;
    expect(firstItem.type).toBe('rich_text_list');
    expect(firstItem.style).toBe('bullet');
    expect(firstItem.indent).toBe(0);
    expect(firstItem.elements).toHaveLength(1);

    const firstSection = firstItem.elements[0] as RichTextSection;
    expect(firstSection.type).toBe('rich_text_section');
    expect((firstSection.elements[0] as RichTextText).text).toBe('First item');
  });

  it('should parse ordered lists as rich text blocks', () => {
    const tokens = marked.lexer(
      `
1. First item
2. Second item
3. Third item
    `.trim(),
    );

    const actual = parseBlocks(tokens, {lists: {useRichText: true}});

    expect(actual).toHaveLength(1);
    expect(actual[0].type).toBe('rich_text');

    const richTextBlock = actual[0] as RichTextBlock;
    expect(richTextBlock.elements).toHaveLength(3);

    // Check first list item
    const firstItem = richTextBlock.elements[0] as RichTextList;
    expect(firstItem.type).toBe('rich_text_list');
    expect(firstItem.style).toBe('ordered');
    expect(firstItem.indent).toBe(0);
    expect(firstItem.elements).toHaveLength(1);

    const firstSection = firstItem.elements[0] as RichTextSection;
    expect(firstSection.type).toBe('rich_text_section');
    expect((firstSection.elements[0] as RichTextText).text).toBe('First item');
  });

  it('should parse rich text formatting in lists', () => {
    const tokens = marked.lexer(
      `
- **Bold text** with _italic_
- ~~Strikethrough~~ and \`code\`
- [Link text](https://example.com)
    `.trim(),
    );

    const actual = parseBlocks(tokens, {lists: {useRichText: true}});

    expect(actual).toHaveLength(1);
    const richTextBlock = actual[0] as RichTextBlock;
    expect(richTextBlock.elements).toHaveLength(3);

    // Check first item formatting
    const firstItem = richTextBlock.elements[0] as RichTextList;
    const firstSection = firstItem.elements[0] as RichTextSection;
    expect(firstSection.elements).toHaveLength(3); // Bold, text, italic

    expect((firstSection.elements[0] as RichTextText).style?.bold).toBe(true);
    expect((firstSection.elements[0] as RichTextText).text).toBe('Bold text');
    expect((firstSection.elements[1] as RichTextText).text).toBe(' with ');
    expect((firstSection.elements[2] as RichTextText).style?.italic).toBe(true);
    expect((firstSection.elements[2] as RichTextText).text).toBe('italic');

    // Check second item formatting
    const secondItem = richTextBlock.elements[1] as RichTextList;
    const secondSection = secondItem.elements[0] as RichTextSection;
    expect((secondSection.elements[0] as RichTextText).style?.strike).toBe(
      true,
    );
    expect((secondSection.elements[0] as RichTextText).text).toBe(
      'Strikethrough',
    );
    expect((secondSection.elements[2] as RichTextText).style?.code).toBe(true);
    expect((secondSection.elements[2] as RichTextText).text).toBe('code');

    // Check third item link
    const thirdItem = richTextBlock.elements[2] as RichTextList;
    const thirdSection = thirdItem.elements[0] as RichTextSection;
    expect((thirdSection.elements[0] as RichTextLink).type).toBe('link');
    expect((thirdSection.elements[0] as RichTextLink).url).toBe(
      'https://example.com',
    );
    expect((thirdSection.elements[0] as RichTextLink).text).toBe('Link text');
  });

  it('should parse nested lists with proper indentation', () => {
    const tokens = marked.lexer(
      `
1. First item
   - Nested bullet one
   - Nested bullet two
2. Second item
   - Another nested item
    `.trim(),
    );

    const actual = parseBlocks(tokens, {lists: {useRichText: true}});

    expect(actual).toHaveLength(1);
    const richTextBlock = actual[0] as RichTextBlock;

    // Should have: item 1, nested 1, nested 2, item 2, nested 3
    expect(richTextBlock.elements).toHaveLength(5);

    // Check top-level items have indent 0
    expect((richTextBlock.elements[0] as RichTextList).indent).toBe(0);
    expect((richTextBlock.elements[3] as RichTextList).indent).toBe(0);

    // Check nested items have indent 1
    expect((richTextBlock.elements[1] as RichTextList).indent).toBe(1);
    expect((richTextBlock.elements[2] as RichTextList).indent).toBe(1);
    expect((richTextBlock.elements[4] as RichTextList).indent).toBe(1);

    // Check styles
    expect((richTextBlock.elements[0] as RichTextList).style).toBe('ordered');
    expect((richTextBlock.elements[1] as RichTextList).style).toBe('bullet');
    expect((richTextBlock.elements[2] as RichTextList).style).toBe('bullet');
    expect((richTextBlock.elements[3] as RichTextList).style).toBe('ordered');
    expect((richTextBlock.elements[4] as RichTextList).style).toBe('bullet');
  });

  it('should fall back to traditional mrkdwn when useRichText is false', () => {
    const tokens = marked.lexer(
      `
- First item
- Second item
    `.trim(),
    );

    const actual = parseBlocks(tokens, {lists: {useRichText: false}});

    expect(actual).toHaveLength(1);
    expect(actual[0].type).toBe('section');

    const sectionBlock = actual[0] as SectionBlock;
    expect(sectionBlock.text?.text).toBe('• First item\n• Second item');
  });

  it('should fall back to traditional mrkdwn when useRichText is not set', () => {
    const tokens = marked.lexer(
      `
- First item
- Second item
    `.trim(),
    );

    const actual = parseBlocks(tokens);

    expect(actual).toHaveLength(1);
    expect(actual[0].type).toBe('section');

    const sectionBlock = actual[0] as SectionBlock;
    expect(sectionBlock.text?.text).toBe('• First item\n• Second item');
  });
});
