export interface ParsingOptions {
  // Configure how lists are displayed
  lists?: ListOptions;
  // Enable rich text rendering for all content instead of mrkdwn sections
  useRichText?: boolean;
}

export interface ListOptions {
  // Configure how checkbox list items are displayed. By default, they are prefixed with '* '
  checkboxPrefix?: (checked: boolean) => string;
  // Enable rich text list rendering instead of mrkdwn sections
  useRichText?: boolean;
}
