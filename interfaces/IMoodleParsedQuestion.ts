import { QuestionTypes } from "../types";
import IMoodleQuestion from "./IMoodleQuestion";
import IMoodleQuestionChoice from "./IMoodleQuestionChoice";
import IMoodleQuestionSettings from "./IMoodleQuestionSettings";

export default interface IMoodleParsedQuestion
  extends Omit<IMoodleQuestion, "html" | "settings"> {
  instance: number;
  text: string;
  settings?: IMoodleQuestionSettings;
  choices?: IMoodleQuestionChoice[];
  chosen?: number;
  answer?: string | IMoodleQuestionChoice;
}
