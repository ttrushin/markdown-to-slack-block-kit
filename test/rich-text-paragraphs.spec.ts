import {parseBlocks} from '../src/parser/internal';
import {marked} from 'marked';
import * as slack from '../src/slack';
import {
  RichTextBlock,
  RichTextList,
  RichTextSection,
  RichTextText,
  RichTextLink,
  SectionBlock,
} from '@slack/types';

describe('rich text paragraphs with global useRichText option', () => {
  it('should parse paragraphs as rich text blocks when global useRichText is enabled', () => {
    const tokens = marked.lexer(
      `
This is a **bold** paragraph with _italic_ text.

Another paragraph with ~~strikethrough~~ and \`code\`.
    `.trim(),
    );

    const actual = parseBlocks(tokens, {useRichText: true});

    expect(actual).toHaveLength(2);

    // First paragraph
    const firstBlock = actual[0] as RichTextBlock;
    expect(firstBlock.type).toBe('rich_text');
    expect(firstBlock.elements).toHaveLength(1);

    const firstSection = firstBlock.elements[0] as RichTextSection;
    expect(firstSection.type).toBe('rich_text_section');
    expect(firstSection.elements).toHaveLength(5); // "This is a ", "bold", " paragraph with ", "italic", " text."

    expect((firstSection.elements[0] as RichTextText).text).toBe('This is a ');
    expect((firstSection.elements[1] as RichTextText).text).toBe('bold');
    expect((firstSection.elements[1] as RichTextText).style?.bold).toBe(true);
    expect((firstSection.elements[2] as RichTextText).text).toBe(
      ' paragraph with ',
    );
    expect((firstSection.elements[3] as RichTextText).text).toBe('italic');
    expect((firstSection.elements[3] as RichTextText).style?.italic).toBe(true);
    expect((firstSection.elements[4] as RichTextText).text).toBe(' text.');

    // Second paragraph
    const secondBlock = actual[1] as RichTextBlock;
    expect(secondBlock.type).toBe('rich_text');
    expect(secondBlock.elements).toHaveLength(1);

    const secondSection = secondBlock.elements[0] as RichTextSection;
    expect(secondSection.type).toBe('rich_text_section');
    expect(secondSection.elements).toHaveLength(5); // "Another paragraph with ", "strikethrough", " and ", "code", "."

    expect((secondSection.elements[0] as RichTextText).text).toBe(
      'Another paragraph with ',
    );
    expect((secondSection.elements[1] as RichTextText).text).toBe(
      'strikethrough',
    );
    expect((secondSection.elements[1] as RichTextText).style?.strike).toBe(
      true,
    );
    expect((secondSection.elements[2] as RichTextText).text).toBe(' and ');
    expect((secondSection.elements[3] as RichTextText).text).toBe('code');
    expect((secondSection.elements[3] as RichTextText).style?.code).toBe(true);
    expect((secondSection.elements[4] as RichTextText).text).toBe('.');
  });

  it('should parse links in paragraphs as rich text links when global useRichText is enabled', () => {
    const tokens = marked.lexer(
      'Visit [Google](https://google.com) for more information.',
    );

    const actual = parseBlocks(tokens, {useRichText: true});

    expect(actual).toHaveLength(1);
    const richTextBlock = actual[0] as RichTextBlock;
    expect(richTextBlock.type).toBe('rich_text');

    const section = richTextBlock.elements[0] as RichTextSection;
    expect(section.elements).toHaveLength(3); // "Visit ", link, " for more information."

    expect((section.elements[0] as RichTextText).text).toBe('Visit ');
    expect((section.elements[1] as RichTextLink).type).toBe('link');
    expect((section.elements[1] as RichTextLink).url).toBe(
      'https://google.com',
    );
    expect((section.elements[1] as RichTextLink).text).toBe('Google');
    expect((section.elements[2] as RichTextText).text).toBe(
      ' for more information.',
    );
  });

  it('should handle images in paragraphs with rich text by splitting into separate blocks', () => {
    const tokens = marked.lexer(
      'Here is some text ![alt text](https://example.com/image.jpg) and more text.',
    );

    const actual = parseBlocks(tokens, {useRichText: true});

    expect(actual).toHaveLength(3); // rich text section, image block, rich text section

    // First rich text section
    const firstBlock = actual[0] as RichTextBlock;
    expect(firstBlock.type).toBe('rich_text');
    const firstSection = firstBlock.elements[0] as RichTextSection;
    expect((firstSection.elements[0] as RichTextText).text).toBe(
      'Here is some text ',
    );

    // Image block
    const imageBlock = actual[1];
    expect(imageBlock.type).toBe('image');
    // Use the same structure as created by slack.image helper
    const expectedImageBlock = slack.image(
      'https://example.com/image.jpg',
      'alt text',
    );
    expect(imageBlock).toStrictEqual(expectedImageBlock);

    // Second rich text section
    const secondBlock = actual[2] as RichTextBlock;
    expect(secondBlock.type).toBe('rich_text');
    const secondSection = secondBlock.elements[0] as RichTextSection;
    expect((secondSection.elements[0] as RichTextText).text).toBe(
      ' and more text.',
    );
  });

  it('should parse lists as rich text when global useRichText is enabled', () => {
    const tokens = marked.lexer(
      `
- First item with **bold** text
- Second item with _italic_ text
    `.trim(),
    );

    const actual = parseBlocks(tokens, {useRichText: true});

    expect(actual).toHaveLength(1);
    const richTextBlock = actual[0] as RichTextBlock;
    expect(richTextBlock.type).toBe('rich_text');
    expect(richTextBlock.elements).toHaveLength(2);

    // First list item
    const firstItem = richTextBlock.elements[0] as RichTextList;
    expect(firstItem.type).toBe('rich_text_list');
    expect(firstItem.style).toBe('bullet');

    const firstSection = firstItem.elements[0] as RichTextSection;
    expect((firstSection.elements[0] as RichTextText).text).toBe(
      'First item with ',
    );
    expect((firstSection.elements[1] as RichTextText).text).toBe('bold');
    expect((firstSection.elements[1] as RichTextText).style?.bold).toBe(true);
    expect((firstSection.elements[2] as RichTextText).text).toBe(' text');

    // Second list item
    const secondItem = richTextBlock.elements[1] as RichTextList;
    expect(secondItem.type).toBe('rich_text_list');
    expect(secondItem.style).toBe('bullet');

    const secondSection = secondItem.elements[0] as RichTextSection;
    expect((secondSection.elements[0] as RichTextText).text).toBe(
      'Second item with ',
    );
    expect((secondSection.elements[1] as RichTextText).text).toBe('italic');
    expect((secondSection.elements[1] as RichTextText).style?.italic).toBe(
      true,
    );
    expect((secondSection.elements[2] as RichTextText).text).toBe(' text');
  });

  it('should maintain mrkdwn behavior when useRichText is false or not set', () => {
    const tokens = marked.lexer(
      'This is a **bold** paragraph with _italic_ text.',
    );

    // Test with useRichText: false
    const actualFalse = parseBlocks(tokens, {useRichText: false});
    expect(actualFalse).toHaveLength(1);
    expect(actualFalse[0].type).toBe('section');
    expect((actualFalse[0] as SectionBlock).text?.text).toBe(
      'This is a *bold* paragraph with _italic_ text.',
    );

    // Test without useRichText option
    const actualDefault = parseBlocks(tokens);
    expect(actualDefault).toHaveLength(1);
    expect(actualDefault[0].type).toBe('section');
    expect((actualDefault[0] as SectionBlock).text?.text).toBe(
      'This is a *bold* paragraph with _italic_ text.',
    );
  });

  it('should override list-specific useRichText when global useRichText is enabled', () => {
    const tokens = marked.lexer(
      `
- List item with **bold** text

Regular paragraph with _italic_ text.
    `.trim(),
    );

    const actual = parseBlocks(tokens, {
      useRichText: true,
      lists: {useRichText: false}, // This should be overridden by global setting
    });

    expect(actual).toHaveLength(2);

    // List should use rich text (global setting overrides list setting)
    const listBlock = actual[0] as RichTextBlock;
    expect(listBlock.type).toBe('rich_text');

    // Paragraph should use rich text
    const paragraphBlock = actual[1] as RichTextBlock;
    expect(paragraphBlock.type).toBe('rich_text');
  });
});
