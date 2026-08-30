import type { Locale } from "./config";

/**
 * English is the source of truth. `Dictionary` is derived from it, so every
 * other locale must supply every key with a matching signature or the build
 * fails. Strings that interpolate values are functions rather than templates
 * with placeholders, which keeps the substitution type-checked and lets each
 * language put the values where its grammar needs them.
 */
const en = {
  common: {
    appName: "Notch",
    loading: "Loading…",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    view: "View",
    male: "Male",
    female: "Female",
    /** Lowercased inside prose, e.g. "a 5-year-old male measuring …". The
     *  explicit `string` return keeps this assignable across locales, which
     *  inference would otherwise narrow to the English literals. */
    sexNoun: (sex: number): string => (sex === 1 ? "male" : "female"),
    disclaimer: "For informational purposes only. Not medical advice.",
    years: (n: number) => `${n} years`,
    /** Joins inline lists; Chinese uses the ideographic comma. */
    listSeparator: ", ",
    egPlaceholder: (value: string) => `e.g. ${value}`,
  },

  header: {
    myChildren: "My children",
    myHistory: "My history",
    guestMode: "Guest mode",
    signIn: "Sign in",
    signUp: "Sign up",
    languageLabel: "Language",
  },

  form: {
    title: "Growth prediction",
    subtitle:
      "Enter your child's measurements for an ML prediction. Add parent heights to also get an LLM-based estimate.",
    guestNoticeLead: "Guest mode — predictions are not saved.",
    guestNoticeSignUp: "Sign up",
    guestNoticeTail: "to keep your history for each child.",
    signedInLead:
      "Signed in — select a child profile to auto-fill sex and age, or",
    signedInManage: "manage profiles",
    childProfileLegend: "Child profile",
    selectChild: "Select child",
    enterManually: "Enter details manually",
    noProfilesYet: "No profiles yet.",
    addAChild: "Add a child",
    toAutoFill: "to auto-fill the form.",
    aboutYourChild: "About your child",
    bornAndAge: (date: string, age: number) => `Born ${date} · age ${age} years`,
    sex: "Sex",
    currentAgeYears: "Current age (years)",
    currentAgeHint: (maxAge: number) =>
      `Up to age ${maxAge}. Beyond that the model has too little data to be reliable.`,
    currentMeasurements: "Current measurements",
    heightCm: "Height (cm)",
    weightKg: "Weight (kg)",
    bmi: "BMI",
    parentsLegend: "Parents (optional)",
    parentHeightsLegend: "Parent heights (optional)",
    parentHeightsHelp:
      "Used for the LLM prediction only. Both heights are required if you fill one in.",
    parentHeightsAutoFilled:
      "Auto-filled from profile — edits are saved when you run a prediction.",
    parentHeightsWillSave:
      "Saved to the child profile when you run a prediction.",
    parentsFromAccount: "Filled in from your account.",
    parentsEditOnAccount: "Change them",
    parentWeightHelp: "Optional. Adds parental build to the LLM estimate.",
    mothersHeightCm: "Mother's height (cm)",
    fathersHeightCm: "Father's height (cm)",
    mothersWeightKg: "Mother's weight (kg)",
    fathersWeightKg: "Father's weight (kg)",
    ethnicityLegend: "Ethnicity (optional)",
    ethnicityHelp: "Select all that apply. Used for LLM predictions only.",
    ethnicityWillSave:
      "Saved to the child profile when you run a prediction.",
    predictionLegend: "Prediction",
    predictAtAgeYears: "Predict at age (years)",
    bothParentHeightsRequired:
      "Please enter both mother and father heights, or leave both blank.",
    llmFailed: "LLM prediction failed",
    somethingWentWrong: "Something went wrong",
    calculating: "Calculating…",
    submit: "Get prediction",
  },

  childForm: {
    editTitle: "Edit child",
    addTitle: "Add child",
    subtitle: "Birth date and sex are used to auto-fill the prediction form.",
    profileLegend: "Profile",
    name: "Name",
    namePlaceholder: "e.g. Alex",
    dateOfBirth: "Date of birth",
    ethnicityLabel: "Ethnicity (optional)",
    ethnicityHelp: "Select all that apply. Used for LLM predictions only.",
    parentHeightsLegend: "Parent heights (optional)",
    parentHeightsHelp:
      "Saved on the profile and auto-filled for LLM predictions.",
    parentHeightsOverrideHelp:
      "Leave blank to use the parent heights on your account. Fill these in only if they differ for this child.",
    accountDefaultPlaceholder: (cm: number) => `${cm} (from your account)`,
    mothersHeightCm: "Mother's height (cm)",
    fathersHeightCm: "Father's height (cm)",
    bothParentHeightsRequired:
      "Please enter both parent heights, or leave both blank.",
    failedToLoad: "Failed to load child",
    failedToSave: "Failed to save",
    saving: "Saving…",
    saveChanges: "Save changes",
    addChild: "Add child",
  },

  children: {
    title: "My children",
    subtitle:
      "Manage child profiles. Selecting a profile on the prediction form auto-fills sex and age from their birth date.",
    addChild: "Add child",
    empty: "No child profiles yet.",
    emptyHelp:
      "Add a profile to track multiple children and auto-fill the prediction form.",
    confirmDelete:
      "Delete this child profile? Saved predictions will be kept.",
    failedToLoad: "Failed to load children",
    failedToDelete: "Failed to delete child",
    bornAndAge: (date: string, age: number) => `born ${date} · age ${age}`,
    parentsLabel: "Parents:",
    motherHeight: (cm: number) => `mother ${cm} cm`,
    fatherHeight: (cm: number) => `father ${cm} cm`,
    ethnicityLabel: (list: string) => `Ethnicity: ${list}`,
    predict: "Predict",
  },

  history: {
    title: "My predictions",
    subtitle:
      "Saved predictions from your account. Guest predictions are not stored.",
    loading: "Loading history…",
    failedToLoad: "Failed to load history",
    empty: "No saved predictions yet.",
    runPrediction: "Run a prediction",
    ageTransition: (from: number, to: number) => `age ${from} → ${to}`,
    llmValue: (cm: string) => `LLM: ${cm} cm`,
  },

  results: {
    eyebrow: "Prediction results",
    chart: {
      title: "Height over time",
      observed: "Measured",
      predicted: "ML prediction",
      llmPredicted: "LLM prediction",
      ageAxis: "age (years)",
      heightAxis: "height (cm)",
    },
    atAge: (age: number) => `At age ${age}`,
    basedOn: (age: number, sexNoun: string, heightCm: number, weightKg: number) =>
      `Based on a ${age}-year-old ${sexNoun} measuring ${heightCm} cm and ${weightKg} kg.`,
    savedToAccount: "Saved to your account",
    viewHistory: "View history",
    mlModel: "ML model (SVR)",
    predictedHeight: "Predicted height",
    predictedWeight: "Predicted weight",
    predictedBmi: "Predicted BMI",
    modelLabel: (model: string) => `Model: ${model}`,
    llmPrediction: "LLM prediction",
    midParental: (cm: string, model: string) =>
      `Mid-parental height: ${cm} cm · Model: ${model}`,
    llmUnavailable: "LLM prediction unavailable",
    /** Only shown if the model returns no reasoning text at all. */
    llmFallbackReasoning:
      "Estimate based on child measurements and parent heights.",
    addParentHeightsHint:
      "Add parent heights on the form to get a separate LLM-based height prediction.",
    inputsUsed: "Inputs used",
    sex: "Sex",
    currentAge: "Current age",
    height: "Height",
    weight: "Weight",
    currentBmi: "Current BMI",
    targetAge: "Target age",
    motherHeight: "Mother height",
    fatherHeight: "Father height",
    editInputs: "Edit inputs",
    newPrediction: "New prediction",
    loading: "Loading results…",
    couldNotLoad: "Could not load results",
    backToForm: "Back to form",
    noResults: "No results yet",
    noResultsHelp: "Submit the prediction form first to see results here.",
    goToForm: "Go to form",
    savedNotFound: "Saved prediction not found",
    failedToLoadPrediction: "Failed to load prediction",
    predictionFailed: "Prediction failed",
  },

  account: {
    title: "Account",
    subtitle: "Manage your account and data.",
    dangerHeading: "Delete account",
    dangerBody:
      "This permanently deletes your account, every child profile, and every saved prediction. It cannot be undone.",
    /** Typed by the user to confirm. Localised so the prompt matches the UI. */
    confirmWord: "DELETE",
    confirmPrompt: (word: string) => `Type ${word} to confirm`,
    confirmPlaceholder: "DELETE",
    deleteButton: "Delete my account",
    deleting: "Deleting…",
    failed: "Could not delete your account",
  },

  /** The account-level parent measurements, shared by onboarding and account. */
  parents: {
    legend: "Parent details",
    accountHelp:
      "Used to fill in the prediction form. Adult height doesn't change, so this is asked once. All fields are optional.",
    mothersHeightCm: "Mother's height (cm)",
    fathersHeightCm: "Father's height (cm)",
    mothersWeightKg: "Mother's weight (kg)",
    fathersWeightKg: "Father's weight (kg)",
    optionalPlaceholder: "Optional",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    failedToSave: "Could not save your details",
    heightOutOfRange: (min: number, max: number) =>
      `Height must be between ${min} and ${max} cm.`,
    weightOutOfRange: (min: number, max: number) =>
      `Weight must be between ${min} and ${max} kg.`,
  },

  onboarding: {
    title: "A couple of details",
    subtitle:
      "Parent height and weight help with the LLM prediction. Enter them once and every prediction is pre-filled. You can skip this and add them later.",
    saveAndContinue: "Save and continue",
    skip: "Skip for now",
    editLater: "You can change these any time from your account page.",
  },

  ethnicity: {
    east_asian: "East Asian",
    south_asian: "South Asian",
    black_african: "Black / African",
    hispanic_latino: "Hispanic / Latino",
    mena: "Middle Eastern / North African",
    white_european: "White / European",
    indigenous: "Indigenous",
    mixed_other: "Mixed / Other",
  },

  metadata: {
    // The brand carries the tab and the store listing; searchable keywords go in
    // the description and, on the App Store, the subtitle field — not the name.
    title: "Notch — Child growth tracker",
    description:
      "Track your child's growth and estimate their future height, weight, and BMI.",
    resultsTitle: "Results | Notch",
    resultsDescription: "Estimated height, weight, and BMI at your target age",
  },
};

export type Dictionary = typeof en;

const zhCN: Dictionary = {
  common: {
    appName: "成长刻度",
    loading: "加载中…",
    cancel: "取消",
    edit: "编辑",
    delete: "删除",
    view: "查看",
    male: "男",
    female: "女",
    sexNoun: (sex: number) => (sex === 1 ? "男孩" : "女孩"),
    disclaimer: "仅供参考，不构成医疗建议。",
    years: (n: number) => `${n} 岁`,
    listSeparator: "、",
    egPlaceholder: (value: string) => `例如 ${value}`,
  },

  header: {
    myChildren: "我的孩子",
    myHistory: "历史记录",
    guestMode: "访客模式",
    signIn: "登录",
    signUp: "注册",
    languageLabel: "语言",
  },

  form: {
    title: "成长预测",
    subtitle:
      "输入孩子的身体数据以获得机器学习预测。填写父母身高还可获得基于大语言模型的估算。",
    guestNoticeLead: "访客模式——预测结果不会保存。",
    guestNoticeSignUp: "注册",
    guestNoticeTail: "即可为每个孩子保存历史记录。",
    signedInLead: "已登录——选择孩子档案可自动填写性别和年龄，或",
    signedInManage: "管理档案",
    childProfileLegend: "孩子档案",
    selectChild: "选择孩子",
    enterManually: "手动输入信息",
    noProfilesYet: "还没有档案。",
    addAChild: "添加孩子",
    toAutoFill: "以自动填写表单。",
    aboutYourChild: "孩子信息",
    bornAndAge: (date: string, age: number) => `出生日期 ${date} · ${age} 岁`,
    sex: "性别",
    currentAgeYears: "当前年龄（岁）",
    currentAgeHint: (maxAge: number) =>
      `最大 ${maxAge} 岁。超过该年龄，模型的数据不足，结果不可靠。`,
    currentMeasurements: "当前身体数据",
    heightCm: "身高（厘米）",
    weightKg: "体重（公斤）",
    bmi: "BMI",
    parentsLegend: "父母信息（可选）",
    parentHeightsLegend: "父母身高（可选）",
    parentHeightsHelp:
      "仅用于大语言模型预测。填写其中一项身高时，两项都需填写。",
    parentHeightsAutoFilled: "已根据档案自动填写——运行预测时会保存修改。",
    parentHeightsWillSave: "运行预测时会保存到孩子档案。",
    parentsFromAccount: "已根据账户信息填写。",
    parentsEditOnAccount: "修改",
    parentWeightHelp: "可选。为大语言模型预测提供父母体型参考。",
    mothersHeightCm: "母亲身高（厘米）",
    fathersHeightCm: "父亲身高（厘米）",
    mothersWeightKg: "母亲体重（公斤）",
    fathersWeightKg: "父亲体重（公斤）",
    ethnicityLegend: "族裔（可选）",
    ethnicityHelp: "可多选。仅用于大语言模型预测。",
    ethnicityWillSave: "运行预测时会保存到孩子档案。",
    predictionLegend: "预测",
    predictAtAgeYears: "预测年龄（岁）",
    bothParentHeightsRequired: "请同时填写父亲和母亲的身高，或两项都留空。",
    llmFailed: "大语言模型预测失败",
    somethingWentWrong: "出现错误",
    calculating: "计算中…",
    submit: "获取预测",
  },

  childForm: {
    editTitle: "编辑孩子",
    addTitle: "添加孩子",
    subtitle: "出生日期和性别用于自动填写预测表单。",
    profileLegend: "档案",
    name: "姓名",
    namePlaceholder: "例如：小明",
    dateOfBirth: "出生日期",
    ethnicityLabel: "族裔（可选）",
    ethnicityHelp: "可多选。仅用于大语言模型预测。",
    parentHeightsLegend: "父母身高（可选）",
    parentHeightsHelp: "保存在档案中，并自动用于大语言模型预测。",
    parentHeightsOverrideHelp:
      "留空则使用账户中的父母身高。仅当这个孩子的情况不同时才需填写。",
    accountDefaultPlaceholder: (cm: number) => `${cm}（来自账户）`,
    mothersHeightCm: "母亲身高（厘米）",
    fathersHeightCm: "父亲身高（厘米）",
    bothParentHeightsRequired: "请同时填写父母双方的身高，或两项都留空。",
    failedToLoad: "加载孩子信息失败",
    failedToSave: "保存失败",
    saving: "保存中…",
    saveChanges: "保存修改",
    addChild: "添加孩子",
  },

  children: {
    title: "我的孩子",
    subtitle:
      "管理孩子档案。在预测表单中选择档案后，会根据出生日期自动填写性别和年龄。",
    addChild: "添加孩子",
    empty: "还没有孩子档案。",
    emptyHelp: "添加档案可管理多个孩子，并自动填写预测表单。",
    confirmDelete: "确定删除该孩子档案吗？已保存的预测记录会保留。",
    failedToLoad: "加载孩子列表失败",
    failedToDelete: "删除孩子失败",
    bornAndAge: (date: string, age: number) => `出生日期 ${date} · ${age} 岁`,
    parentsLabel: "父母：",
    motherHeight: (cm: number) => `母亲 ${cm} 厘米`,
    fatherHeight: (cm: number) => `父亲 ${cm} 厘米`,
    ethnicityLabel: (list: string) => `族裔：${list}`,
    predict: "预测",
  },

  history: {
    title: "我的预测记录",
    subtitle: "您账户中已保存的预测记录。访客模式下的预测不会保存。",
    loading: "正在加载历史记录…",
    failedToLoad: "加载历史记录失败",
    empty: "还没有保存的预测记录。",
    runPrediction: "开始预测",
    ageTransition: (from: number, to: number) => `${from} 岁 → ${to} 岁`,
    llmValue: (cm: string) => `大语言模型：${cm} 厘米`,
  },

  results: {
    eyebrow: "预测结果",
    chart: {
      title: "身高变化",
      observed: "实测",
      predicted: "机器学习预测",
      llmPredicted: "大语言模型预测",
      ageAxis: "年龄（岁）",
      heightAxis: "身高（厘米）",
    },
    atAge: (age: number) => `${age} 岁时`,
    basedOn: (age: number, sexNoun: string, heightCm: number, weightKg: number) =>
      `基于一名 ${age} 岁${sexNoun}，身高 ${heightCm} 厘米，体重 ${weightKg} 公斤。`,
    savedToAccount: "已保存到您的账户",
    viewHistory: "查看历史记录",
    mlModel: "机器学习模型（SVR）",
    predictedHeight: "预测身高",
    predictedWeight: "预测体重",
    predictedBmi: "预测 BMI",
    modelLabel: (model: string) => `模型：${model}`,
    llmPrediction: "大语言模型预测",
    midParental: (cm: string, model: string) =>
      `父母平均身高：${cm} 厘米 · 模型：${model}`,
    llmUnavailable: "大语言模型预测不可用",
    llmFallbackReasoning: "该估算基于孩子的身体数据和父母身高。",
    addParentHeightsHint:
      "在表单中填写父母身高，即可获得独立的大语言模型身高预测。",
    inputsUsed: "使用的输入数据",
    sex: "性别",
    currentAge: "当前年龄",
    height: "身高",
    weight: "体重",
    currentBmi: "当前 BMI",
    targetAge: "目标年龄",
    motherHeight: "母亲身高",
    fatherHeight: "父亲身高",
    editInputs: "修改输入",
    newPrediction: "重新预测",
    loading: "正在加载结果…",
    couldNotLoad: "无法加载结果",
    backToForm: "返回表单",
    noResults: "暂无结果",
    noResultsHelp: "请先提交预测表单以查看结果。",
    goToForm: "前往表单",
    savedNotFound: "未找到已保存的预测",
    failedToLoadPrediction: "加载预测失败",
    predictionFailed: "预测失败",
  },

  account: {
    title: "账户",
    subtitle: "管理您的账户和数据。",
    dangerHeading: "删除账户",
    dangerBody:
      "这将永久删除您的账户、所有孩子档案以及所有已保存的预测记录，且无法恢复。",
    confirmWord: "删除",
    confirmPrompt: (word: string) => `请输入“${word}”以确认`,
    confirmPlaceholder: "删除",
    deleteButton: "删除我的账户",
    deleting: "正在删除…",
    failed: "无法删除您的账户",
  },

  parents: {
    legend: "父母信息",
    accountHelp:
      "用于自动填写预测表单。成人身高不会变化，因此只需填写一次。所有项均为可选。",
    mothersHeightCm: "母亲身高（厘米）",
    fathersHeightCm: "父亲身高（厘米）",
    mothersWeightKg: "母亲体重（公斤）",
    fathersWeightKg: "父亲体重（公斤）",
    optionalPlaceholder: "可选",
    save: "保存",
    saving: "保存中…",
    saved: "已保存",
    failedToSave: "无法保存您的信息",
    heightOutOfRange: (min: number, max: number) =>
      `身高需在 ${min} 至 ${max} 厘米之间。`,
    weightOutOfRange: (min: number, max: number) =>
      `体重需在 ${min} 至 ${max} 公斤之间。`,
  },

  onboarding: {
    title: "补充几项信息",
    subtitle:
      "父母的身高和体重有助于大语言模型预测。填写一次后，每次预测都会自动填入。您也可以跳过，稍后再补充。",
    saveAndContinue: "保存并继续",
    skip: "暂时跳过",
    editLater: "您可以随时在账户页面修改这些信息。",
  },

  ethnicity: {
    east_asian: "东亚",
    south_asian: "南亚",
    black_african: "非洲裔",
    hispanic_latino: "拉丁裔",
    mena: "中东 / 北非",
    white_european: "欧洲裔",
    indigenous: "原住民",
    mixed_other: "混合 / 其他",
  },

  metadata: {
    title: "成长刻度 — 儿童成长记录",
    description: "记录孩子的成长，并估算未来的身高、体重和 BMI。",
    resultsTitle: "预测结果 | 成长刻度",
    resultsDescription: "目标年龄的身高、体重和 BMI 估算",
  },
};

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  "zh-CN": zhCN,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
