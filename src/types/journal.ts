export type Point = [number, number];
export interface JournalCondition {
  terms?: string[];
  conclusions?: string[];
  completed?: string[];
}
export interface JournalStyle {
  font_size?: number;
  layer?: number;
  contour?: Point[];
  arrow?: boolean;
  curve?: boolean;
}
export interface JournalElement {
  id: string;
  type: "term" | "quote" | "group" | "conclusion" | "page_link";
  reference_id: string;
  position: Point;
  size: Point;
  style: JournalStyle;
  reveal_condition: JournalCondition;
}
export interface JournalPage {
  id: string;
  section: "notes" | "words";
  title: string;
  order: number;
  elements: JournalElement[];
  reveal_condition: JournalCondition;
}
export interface JournalConnection {
  id: string;
  source_id: string;
  target_id: string;
  path_points: Point[];
  style: JournalStyle;
  activation_condition: JournalCondition;
}
export interface JournalInteraction {
  id: string;
  type: "compare" | "connect" | "revise";
  source_ids: string[];
  options: { id: string; text: string }[];
  activation_condition: JournalCondition;
  strike_ids: string[];
}
export interface JournalLayout {
  schema_version: 1;
  id: string;
  test_content: boolean;
  pages: JournalPage[];
  connections: JournalConnection[];
  interactions: JournalInteraction[];
}
export interface JournalPreviewState {
  terms: string[];
  conclusions: string[];
  completed: string[];
}
