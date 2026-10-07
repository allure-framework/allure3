type FindingWithSubject = {
  subject_ref?: string;
  subject:
    | string
    | {
        type: string;
        id?: string;
        path?: string;
      };
};

export const findingSubjectRef = (finding: FindingWithSubject) => {
  if (finding.subject_ref) {
    return finding.subject_ref;
  }

  if (typeof finding.subject === "string") {
    return finding.subject;
  }

  return finding.subject.path ?? finding.subject.id ?? finding.subject.type;
};
