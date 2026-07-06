/**
 * Smart Professional Guidance (SPG) — AI guidance engine.
 *
 * Generates structured professional guidance for a specific role and sector
 * based on 7 wizard answers. Output covers:
 *   • Professional guidance summary
 *   • Required actions
 *   • Required documents
 *   • Legal/regulatory references (clearly binding vs. best-practice)
 *   • Practical warnings
 *   • Common mistakes
 *   • Next-step checklist
 *   • Escalation recommendation
 *
 * Anti-hallucination rules:
 *   • Must not fabricate law numbers, article numbers, or case references.
 *   • Must clearly mark every reference as BINDING or BEST_PRACTICE.
 *   • Must include the standard non-substitution disclaimer.
 *   • Must not present guidance as a binding legal decision.
 */

import { aiRouter, TaskType } from "../ai/index.js";
import { parseModelJson }     from "../ai/providers/interface.js";

// ─── Types (mirrored from frontend types/spg.ts) ──────────────────────────────

export interface SpgWizardAnswers {
  incident:  string;
  stage:     string;
  documents: string;
  action:    string;
  risks:     string;
  nextStep:  string;
}

export interface SpgLegalReference {
  title:     string;
  type:      'law' | 'regulation' | 'decree' | 'principle' | 'standard' | 'guideline';
  reference: string;
  binding:   boolean;
}

export interface SpgChecklistItem {
  step:      string;
  priority:  'high' | 'medium' | 'low';
  mandatory: boolean;
}

export interface SpgGuidanceOutput {
  summary:                  string;
  requiredActions:          string[];
  requiredDocuments:        string[];
  legalReferences:          SpgLegalReference[];
  practicalWarnings:        string[];
  commonMistakes:           string[];
  nextStepChecklist:        SpgChecklistItem[];
  escalationRecommendation: string | null;
  disclaimer:               string;
}

// ─── Role-specific context blocks ────────────────────────────────────────────
// These supply AI with role-appropriate framing without hallucinating specifics.

const ROLE_CONTEXT: Record<string, string> = {
  judge:                'القاضي مسؤول عن الفصل في النزاعات وفق أحكام القانون وتسبيب الأحكام.',
  prosecutor:           'وكيل النيابة مسؤول عن مباشرة الدعوى الجنائية والتحقيق والادعاء العام.',
  lawyer:               'المحامي يمثل موكله ويقدم الاستشارات القانونية ويُدافع عن حقوقه أمام الجهات المختصة.',
  legal_advisor:        'المستشار القانوني يُقدم الرأي القانوني للجهة ويُراجع العقود والقرارات الإدارية.',
  legal_researcher:     'الباحث القانوني يُجري البحث والتحليل القانوني ويُعد المذكرات والدراسات.',
  police_officer:       'ضابط الشرطة يُطبق القانون ويُنفذ قرارات القضاء ويضبط الجرائم.',
  judicial_officer:     'رجل الضبط القضائي يتمتع بصلاحيات محددة في ضبط الجرائم وجمع الأدلة.',
  forensic_investigator:'المحقق الجنائي يُجري التحقيق الجنائي ويجمع الأدلة ويُعد تقارير التحقيق.',
  forensic_evidence:    'خبير الأدلة الجنائية يُحلل الأدلة المادية ويُعد تقارير خبرة قضائية.',
  crime_scene:          'فاحص مسرح الجريمة يُوثّق ويجمع الأدلة المادية وفق بروتوكولات محددة.',
  admin_decision_maker: 'متخذ القرار الإداري يُصدر القرارات ويتحمل مسؤوليتها القانونية والإدارية.',
  admin_investigator:   'المحقق الإداري يُجري التحقيقات الإدارية ويُعد التقارير ويُوصي بالجزاءات.',
  hr:                   'مسؤول الموارد البشرية يُدير العلاقات الوظيفية ويُطبق سياسات الخدمة المدنية.',
  legal_affairs:        'مسؤول الشؤون القانونية يتولى متابعة القضايا والعقود والاستشارات القانونية.',
  internal_audit:       'المدقق الداخلي يفحص الأنظمة والعمليات ويُقيّم مدى الامتثال والرقابة الداخلية.',
  risk_management:      'مسؤول إدارة المخاطر يُحدد المخاطر ويُقيّمها ويُعد خطط الاستجابة.',
  compliance:           'مسؤول الامتثال يضمن التزام الجهة بالتشريعات واللوائح والمعايير المعتمدة.',
  anti_corruption:      'مسؤول مكافحة الفساد يُراقب ويُبلّغ ويتحقق من مخاطر الفساد والرشوة.',
  strategic_planning:   'مخطط استراتيجي يضع الأهداف ويُحلل البيئة ويُعد الخطط الاستراتيجية.',
  kpi_management:       'مسؤول مؤشرات الأداء يُصمم ويُتابع ويُحلل مؤشرات الأداء المؤسسي.',
  project_management:   'مدير المشاريع يُخطط وينفذ ويراقب المشاريع وفق المنهجيات المعتمدة.',
  change_management:    'مدير التغيير يقود عمليات التحول المؤسسي ويُدير مقاومة التغيير.',
  iso:                  'مسؤول ISO يُطبق متطلبات المعايير الدولية ويُعد وثائق الجودة ويُشرف على الاعتماد.',
  efqm:                 'مسؤول EFQM يُطبق نموذج التميز الأوروبي ويُقيّم الأداء المؤسسي.',
  six_sigma:            'متخصص Six Sigma يُطبق منهجية DMAIC لتحسين العمليات وتقليل العيوب.',
  government_finance:   'مسؤول المالية الحكومية يُدير الموازنات ويُعد التقارير المالية ويضمن الامتثال.',
  taxation:             'مسؤول الضرائب يُطبق التشريعات الضريبية ويُعد الإقرارات ويُدير النزاعات الضريبية.',
  procurement:          'مسؤول المشتريات يُنفذ إجراءات التوريد والتعاقد وفق اللوائح المعتمدة.',
  contracts:            'مسؤول العقود يُعد ويُراجع ويُتابع تنفيذ العقود ويُدير النزاعات التعاقدية.',
  ai_governance:        'مسؤول حوكمة الذكاء الاصطناعي يُصمم سياسات الذكاء الاصطناعي ويضمن الاستخدام الأخلاقي.',
  algorithm_review:     'مُراجع الخوارزميات يُقيّم نماذج الذكاء الاصطناعي من حيث الدقة والعدالة والشفافية.',
  data_protection:      'مسؤول حماية البيانات يضمن الامتثال لتشريعات البيانات ويُدير حقوق أصحاب البيانات.',
  cybersecurity:        'مسؤول الأمن السيبراني يحمي الأنظمة والبيانات ويستجيب للحوادث الأمنية.',
  researcher:           'الباحث الأكاديمي يُجري الدراسات ويُحلل البيانات وينشر النتائج وفق المعايير الأكاديمية.',
  scientific_supervisor:'المشرف العلمي يُوجه الباحثين ويُقيّم الأعمال البحثية ويضمن جودتها المنهجية.',
  masters_student:      'طالب الماجستير يُعد رسالة علمية ذات مستوى أكاديمي يُسهم في المعرفة المتخصصة.',
  phd_student:          'طالب الدكتوراه يُجري بحثاً أصيلاً يُضيف معرفة جديدة في مجاله التخصصي.',
};

const SECTOR_LEGAL_FRAME: Record<string, string> = {
  law_judiciary:          'الإطار القانوني الإماراتي: قانون السلطة القضائية، قانون الإجراءات المدنية والجزائية، قانون المحكمة الاتحادية العليا.',
  security_investigation: 'الإطار القانوني: قانون الإجراءات الجزائية الاتحادي، قانون مكافحة الجرائم المعلوماتية، اللوائح الأمنية المعتمدة.',
  government_admin:       'الإطار القانوني: قانون الموارد البشرية في الحكومة الاتحادية، قانون الإجراءات الإدارية، لائحة التحقيقات الإدارية.',
  governance_oversight:   'الإطار القانوني: قانون الحوكمة، معايير التدقيق الداخلي IIA، لائحة مكافحة الفساد، متطلبات الرقابة.',
  strategy_development:   'الإطار المرجعي: خطة الإمارات 2031، معايير إدارة المشاريع PMI/PRINCE2، أُطر التخطيط الاستراتيجي الحكومي.',
  quality_standards:      'الإطار المرجعي: متطلبات ISO (9001/14001/27001)، نموذج EFQM للتميز، منهجية Six Sigma DMAIC.',
  finance_economy:        'الإطار القانوني: قانون المالية العامة، قانون المناقصات والمزايدات، قانون الضريبة على القيمة المضافة، معايير المحاسبة الحكومية.',
  ai_digital:             'الإطار التنظيمي: سياسة الإمارات للذكاء الاصطناعي، مرسوم بقانون رقم 45 لسنة 2021 بشأن حماية البيانات، الإطار الوطني للأمن السيبراني.',
  academics:              'الإطار الأكاديمي: معايير هيئة الاعتماد الأكاديمي، أخلاقيات البحث العلمي، معايير النشر الأكاديمي الدولي.',
};

// ─── Main engine function ─────────────────────────────────────────────────────

export async function runSpgGuidance(params: {
  sectorId:     string;
  sectorNameAr: string;
  roleId:       string;
  roleNameAr:   string;
  answers:      SpgWizardAnswers;
}): Promise<SpgGuidanceOutput> {
  const { sectorId, sectorNameAr, roleId, roleNameAr, answers } = params;

  const roleContext   = ROLE_CONTEXT[roleId]   ?? `${roleNameAr} — متخصص في مجاله.`;
  const legalFrame    = SECTOR_LEGAL_FRAME[sectorId] ?? 'يُطبَّق الإطار التشريعي الإماراتي المعمول به.';

  const ai = await aiRouter.routeFor(TaskType.RAG);

  const systemPrompt = `أنت مستشار مهني ذكي متخصص في تقديم الإرشاد المهني الدقيق للمتخصصين الإماراتيين.

دورك:
• تقديم إرشاد مهني عملي ومنظّم لـ${roleNameAr} في قطاع: ${sectorNameAr}.
• دور المتخصص: ${roleContext}
• الإطار التشريعي المرجعي: ${legalFrame}

قواعد صارمة — يجب الالتزام بها دون استثناء:
1. لا تُلفق أرقام قوانين أو مواد أو أحكام قضائية لم تَذكرها البيانات المُدخلة.
2. عند ذكر أي مرجع تشريعي، صنّفه بوضوح: BINDING (ملزم قانوناً) أو BEST_PRACTICE (ممارسة فضلى).
3. هذا الإرشاد لا يُعدّ قراراً قانونياً ملزماً ولا يحلّ محل الجهة المختصة.
4. فرّق دائماً بين المتطلبات القانونية الإلزامية والممارسات المهنية الموصى بها.
5. إذا كانت المعلومات غير كافية، أشر إلى الحاجة لمعلومات إضافية في قسم escalationRecommendation.
6. استخدم العربية أساساً في كل محتوى النص، وأضف المصطلح الإنجليزي بين قوسين عند الضرورة.

يجب أن يُميّز إرشادك بوضوح بين:
• المتطلبات القانونية الإلزامية (binding: true)
• الممارسات المهنية الموصى بها (binding: false)`;

  const userPrompt = `الواقعة أو المهمة:
${answers.incident}

المرحلة الحالية:
${answers.stage}

المستندات المتوفرة:
${answers.documents}

الإجراء المطلوب:
${answers.action}

المخاطر المحتملة:
${answers.risks}

الخطوة التالية المتوقعة:
${answers.nextStep}

---
أَنتج كائن JSON واحداً يلتزم بالمخطط التالي بدقة. لا تضف أي نص خارج JSON:

{
  "summary": "فقرة إرشادية موجزة تُلخص الموقف والتوجيه المهني المناسب (200-350 كلمة)",
  "requiredActions": [
    "الإجراء المطلوب 1 — صِفه بدقة",
    "الإجراء المطلوب 2"
  ],
  "requiredDocuments": [
    "المستند المطلوب 1",
    "المستند المطلوب 2"
  ],
  "legalReferences": [
    {
      "title": "اسم التشريع أو المعيار",
      "type": "law|regulation|decree|principle|standard|guideline",
      "reference": "رقم ومرجع التشريع (اذكر فقط ما تعرفه بيقين)",
      "binding": true
    }
  ],
  "practicalWarnings": [
    "تحذير عملي 1",
    "تحذير عملي 2"
  ],
  "commonMistakes": [
    "الخطأ الشائع 1",
    "الخطأ الشائع 2"
  ],
  "nextStepChecklist": [
    {
      "step": "وصف الخطوة",
      "priority": "high|medium|low",
      "mandatory": true
    }
  ],
  "escalationRecommendation": "متى ينبغي رفع الأمر لجهة أعلى أو متخصص آخر — أو null إذا لم يكن ذلك ضرورياً",
  "disclaimer": "هذا الإرشاد المهني لأغراض توجيهية فقط ولا يُعدّ قراراً قانونياً ملزماً ولا يحلّ محل الجهة المختصة أو المستشار القانوني المعتمد. المتطلبات القانونية الملزمة مُحدَّدة بوضوح في الإرشاد."
}`;

  const raw = await ai.complete({
    taskType:     TaskType.RAG,
    prompt:       userPrompt,
    systemPrompt: systemPrompt,
    maxTokens:    4000,
  });

  const parsed = parseModelJson<SpgGuidanceOutput>(raw.text);

  if (!parsed.ok) {
    throw new Error(`SPG engine: AI returned non-JSON output. Raw: ${parsed.raw.slice(0, 200)}`);
  }

  const output = parsed.data;

  // Ensure disclaimer is always present
  if (!output.disclaimer) {
    output.disclaimer = 'هذا الإرشاد المهني لأغراض توجيهية فقط ولا يُعدّ قراراً قانونياً ملزماً ولا يحلّ محل الجهة المختصة أو المستشار القانوني المعتمد.';
  }

  return output;
}
