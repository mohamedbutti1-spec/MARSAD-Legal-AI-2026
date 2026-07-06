/**
 * PGF Institutional Memory — seed data
 *
 * A curated set of institutional memory entries for selected professions.
 * Idempotent: each entry is checked by (profession_id, stage_id, title)
 * before inserting. Skips any that already exist.
 */
import { db, pgfInstitutionalMemoryTable } from "@workspace/db";
import { eq, and, sql }                    from "drizzle-orm";
import { logger }                          from "../lib/logger.js";

interface SeedEntry {
  sectorId:     string;
  professionId: string;
  stageId:      string;
  title:        string;
  content:      string;
  category:     string;
  confidence:   number;
  sourceType:   string;
}

const SEED_ENTRIES: SeedEntry[] = [
  // ── JUDGE — s1_complaint ────────────────────────────────────────────────────
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s1_complaint",
    title: "الفحص الأولي للاختصاص",
    content: "القضاة الخبراء يبدؤون بسؤال الاختصاص قبل أي إجراء آخر. دعوى تُقبل بلا اختصاص تُهدر وقت المحكمة وحقوق الأطراف. التحقق من الاختصاص النوعي والمكاني والقيمي في خطوة واحدة يمنع المفاجآت لاحقاً.",
    category: "expert_practice", confidence: 95, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s1_complaint",
    title: "الخلط بين قبول الدعوى والحكم بها",
    content: "خطأ شائع: رفض الدعوى في مرحلة الفحص الأولي لأسباب موضوعية. مرحلة الفحص الأولي تُعنى بالشكل والاختصاص فقط — الموضوع يُحسم لاحقاً. الخلط يُشكّل حرمان من التقاضي ويُعرّض الحكم للنقض.",
    category: "frequent_mistake", confidence: 92, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s1_complaint",
    title: "توثيق الاختصاص في ديباجة الحكم",
    content: "كل حكم ابتدائي يجب أن يتضمن في ديباجته تسبيباً صريحاً لاختصاص المحكمة. القضاة الذين يُهملون هذا يجدون أحكامهم معرضة للنقض شكلاً لا موضوعاً.",
    category: "lesson_learned", confidence: 90, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s1_complaint",
    title: "تسلسل الفحص الموصى به",
    content: "1. الاختصاص النوعي → 2. الاختصاص المكاني → 3. الاختصاص القيمي → 4. التحقق من أطراف الدعوى → 5. استيفاء الشروط الشكلية للصحيفة → 6. التحقق من سبق الفصل أو تعليق القضية.",
    category: "recommended_sequence", confidence: 93, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s1_complaint",
    title: "مؤشر نجاح الفحص الأولي",
    content: "قبول الدعوى للنظر دون اعتراض لاحق على الاختصاص من أي طرف، وتحديد موعد الجلسة الأولى في المهلة القانونية.",
    category: "success_indicator", confidence: 88, sourceType: "institutional",
  },

  // ── JUDGE — s2_evidence ─────────────────────────────────────────────────────
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s2_evidence",
    title: "المناقشة التلقائية لمشروعية الدليل",
    content: "القضاة الخبراء يرفعون مسألة مشروعية الدليل من تلقاء أنفسهم حتى إن لم يُثرها الدفاع. دليل مشروعيته مشكوك فيه — حتى لو قدّمه الادعاء دون اعتراض — يُلوّث الحكم ويُعرّضه للطعن.",
    category: "expert_practice", confidence: 96, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s2_evidence",
    title: "قبول الأدلة الرقمية دون فحص السلسلة",
    content: "الأدلة الرقمية (سجلات، لقطات، مراسلات) تستلزم التحقق من سلامة سلسلة الحيازة. قبولها دون فحص يُخل بضمانات المحاكمة العادلة.",
    category: "frequent_mistake", confidence: 91, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s2_evidence",
    title: "توثيق رفض الأدلة بتسبيب مفصل",
    content: "رفض دليل دون تسبيب واضح هو أكثر أسباب نقض الأحكام شيوعاً في دائرة الاستئناف. التسبيب لرفض الدليل يجب أن يكون أكثر إسهاباً من تسبيب قبوله.",
    category: "lesson_learned", confidence: 94, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s2_evidence",
    title: "دليل تعزيزي لكل دليل رئيسي",
    content: "القضاة المتمرسون يبحثون عن دليل تعزيزي لكل دليل رئيسي. الحكم المبني على دليل وحيد يُعدّ هشاً حتى لو كان قاطعاً في ظاهره.",
    category: "practical_tip", confidence: 89, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "judge", stageId: "s2_evidence",
    title: "مؤشر إخفاق في تقييم الأدلة",
    content: "حكم يُقبل دليلاً رقمياً دون التثبت من مصدره وسلامة تسلسل حيازته — مؤشر مؤكد على طعن ناجح في الاستئناف.",
    category: "failure_indicator", confidence: 90, sourceType: "institutional",
  },

  // ── ADMIN_DECISION_MAKER — s1_legal_basis ───────────────────────────────────
  {
    sectorId: "government", professionId: "admin_decision_maker", stageId: "s1_legal_basis",
    title: "ترتيب هرمية المصادر القانونية",
    content: "صانع القرار الخبير يُرتّب المصادر القانونية هرمياً قبل الاستشهاد بها: الدستور → القانون الاتحادي → المرسوم بقانون → القانون المحلي → اللائحة التنفيذية → التعليمات الإدارية. أي تعارض يُحسم لصالح الأعلى درجةً.",
    category: "expert_practice", confidence: 97, sourceType: "institutional",
  },
  {
    sectorId: "government", professionId: "admin_decision_maker", stageId: "s1_legal_basis",
    title: "الاستناد إلى لائحة ألغتها تعديلات لاحقة",
    content: "أكثر الأخطاء القانونية شيوعاً: الاستناد إلى نص لائحي لم يُتحقق من سريانه الحالي. التشريعات الإماراتية تشهد تحديثات متكررة وخاصة بعد 2020.",
    category: "frequent_mistake", confidence: 95, sourceType: "institutional",
  },
  {
    sectorId: "government", professionId: "admin_decision_maker", stageId: "s1_legal_basis",
    title: "الجمع بين مصدرين تشريعيين في القرار الواحد",
    content: "القرارات الإدارية التي تستند إلى مصدر تشريعي واحد أكثر عرضة للطعن من تلك التي تُرسّخ أساسها القانوني بمصدرين أو أكثر متكاملين.",
    category: "lesson_learned", confidence: 91, sourceType: "institutional",
  },
  {
    sectorId: "government", professionId: "admin_decision_maker", stageId: "s1_legal_basis",
    title: "تسلسل بناء السند القانوني",
    content: "1. تحديد موضوع القرار بدقة → 2. البحث في التشريعات الناظمة → 3. التحقق من سريان كل نص → 4. فحص التعارضات → 5. بناء السند من الأعلى درجةً نزولاً → 6. مراجعة قانونية.",
    category: "recommended_sequence", confidence: 94, sourceType: "institutional",
  },
  {
    sectorId: "government", professionId: "admin_decision_maker", stageId: "s1_legal_basis",
    title: "مؤشر نجاح السند القانوني",
    content: "قرار يستند إلى نص سارٍ محدد الرقم والتاريخ، تم التحقق من عدم تعديله أو إلغائه، وحاز مراجعة قانونية — مؤشرات نجاح موثوقة.",
    category: "success_indicator", confidence: 92, sourceType: "institutional",
  },

  // ── QUALITY_MANAGER — s1_scope ──────────────────────────────────────────────
  {
    sectorId: "quality_tech", professionId: "quality_manager", stageId: "s1_scope",
    title: "التدقيق المدفوع بالمخاطر",
    content: "مديرو الجودة المتمرسون يُصممون نطاق التدقيق بناءً على المخاطر وليس على الجداول الشكلية. يُعطون الأولوية للعمليات التي يكون فشلها مباشراً على رضا العميل أو سلامة المنتج.",
    category: "expert_practice", confidence: 93, sourceType: "institutional",
  },
  {
    sectorId: "quality_tech", professionId: "quality_manager", stageId: "s1_scope",
    title: "توسيع النطاق بما يتجاوز طاقة الفريق",
    content: "نطاق تدقيق واسع جداً ينتج ملاحظات سطحية غير مقنعة. النطاق الضيق المُعمَّق يُعطي قيمة أعلى ويُغيّر ممارسات فعلية.",
    category: "frequent_mistake", confidence: 90, sourceType: "institutional",
  },
  {
    sectorId: "quality_tech", professionId: "quality_manager", stageId: "s1_scope",
    title: "بيانات الجودة تُخبر قبل التخطيط",
    content: "مراجعة بيانات الجودة السابقة قبل تصميم خطة التدقيق تجعل نطاق التدقيق موجهاً بالأدلة لا بالتقدير. شكاوى العملاء وبيانات العيوب هي الخريطة الأفضل لتحديد الأولويات.",
    category: "lesson_learned", confidence: 88, sourceType: "institutional",
  },
  {
    sectorId: "quality_tech", professionId: "quality_manager", stageId: "s1_scope",
    title: "نقطة انطلاق دائمة: نتائج التدقيق السابق",
    content: "ابدأ دائماً بمراجعة حالة الإجراءات التصحيحية من التدقيق السابق. التدقيق الذي لا يُتابع ما قبله يُضيّع الجهد المتراكم.",
    category: "practical_tip", confidence: 91, sourceType: "institutional",
  },
  {
    sectorId: "quality_tech", professionId: "quality_manager", stageId: "s1_scope",
    title: "مؤشر فشل تخطيط التدقيق",
    content: "خطة تدقيق تُجامل الوحدات الإدارية العليا بإخراجها من النطاق — مؤشر على تدقيق شكلي لن يُضيف قيمة حقيقية.",
    category: "failure_indicator", confidence: 89, sourceType: "institutional",
  },

  // ── CYBERSECURITY_OFFICER — s1_incident ─────────────────────────────────────
  {
    sectorId: "quality_tech", professionId: "cybersecurity_officer", stageId: "s1_incident",
    title: "التوثيق الفوري كأولى الأولويات",
    content: "مسؤولو الأمن المتمرسون يُوثّقون كل شيء فور ملاحظته — التوقيت الدقيق، أول ما شوهد، الأنظمة المتأثرة — قبل أي إجراء آخر. الذاكرة تتلاشى والأدلة تُفقد إن لم تُوثَّق فوراً.",
    category: "expert_practice", confidence: 96, sourceType: "institutional",
  },
  {
    sectorId: "quality_tech", professionId: "cybersecurity_officer", stageId: "s1_incident",
    title: "تقليل خطورة الحادثة بدون فحص",
    content: "الخطأ الأكثر تكلفةً: تصنيف حادثة على أنها 'بسيطة' قبل التحقق من نطاقها الكامل. حادثة صغيرة الظاهر قد تكون جزءاً من هجوم موسع.",
    category: "frequent_mistake", confidence: 94, sourceType: "institutional",
  },
  {
    sectorId: "quality_tech", professionId: "cybersecurity_officer", stageId: "s1_incident",
    title: "قرارات بمعلومات ناقصة",
    content: "في إدارة الحوادث الأمنية، انتظار المعلومات الكاملة قبل التصرف يُتيح للمهاجم وقتاً ثميناً. الخبرة تُعلّمك أن تُقرر بـ70% من المعلومات وتُراجع قرارك مع اكتمال الصورة.",
    category: "lesson_learned", confidence: 92, sourceType: "institutional",
  },
  {
    sectorId: "quality_tech", professionId: "cybersecurity_officer", stageId: "s1_incident",
    title: "تفعيل فريق الاستجابة قبل اليقين",
    content: "لا تنتظر التأكيد الكامل قبل تفعيل فريق الاستجابة في الحوادث العالية والحرجة. تنبيه مبكر مع رفع الإنذار لاحقاً أفضل من استجابة متأخرة.",
    category: "practical_tip", confidence: 90, sourceType: "institutional",
  },
  {
    sectorId: "quality_tech", professionId: "cybersecurity_officer", stageId: "s1_incident",
    title: "مؤشر نجاح إدارة الحادثة الأولية",
    content: "تصنيف واضح في أول 15 دقيقة، فريق استجابة مُفعَّل وفق مستوى الخطورة، وبدء التوثيق التفصيلي — هذه المؤشرات الثلاثة تُنبئ باستجابة منضبطة.",
    category: "success_indicator", confidence: 91, sourceType: "institutional",
  },

  // ── INTERNAL_AUDITOR — s1_planning ──────────────────────────────────────────
  {
    sectorId: "governance", professionId: "internal_auditor", stageId: "s1_planning",
    title: "تقييم المخاطر قبل التخطيط",
    content: "المدققون الداخليون الخبراء يبدؤون بتقييم مخاطر بيئة العمل قبل تصميم خطة التدقيق. المخاطر تُحدد الأولويات وتضمن أن موارد التدقيق المحدودة تذهب للمناطق الأكثر أهمية.",
    category: "expert_practice", confidence: 94, sourceType: "institutional",
  },
  {
    sectorId: "governance", professionId: "internal_auditor", stageId: "s1_planning",
    title: "تكرار نفس مهام التدقيق سنة بعد سنة",
    content: "خطط التدقيق التي تُكرر نفس النطاق سنوياً دون مراجعة قائمة على المخاطر تُصبح روتيناً شكلياً لا يُضيف قيمة. قيمة التدقيق تأتي من استكشاف مناطق غير مُدقَّق عليها.",
    category: "frequent_mistake", confidence: 91, sourceType: "institutional",
  },
  {
    sectorId: "governance", professionId: "internal_auditor", stageId: "s1_planning",
    title: "التنسيق مع التدقيق الخارجي يُوفّر الجهد",
    content: "التنسيق مع المدقق الخارجي في التخطيط يمنع تكرار الجهد ويسمح للتدقيق الداخلي بتغطية مناطق لا يُركّز عليها التدقيق الخارجي.",
    category: "lesson_learned", confidence: 89, sourceType: "institutional",
  },
  {
    sectorId: "governance", professionId: "internal_auditor", stageId: "s1_planning",
    title: "مؤشر خطة تدقيق فعّالة",
    content: "خطة تدقيق تُوافق عليها الإدارة العليا وتربط نطاقها بمخاطر محددة وتُحدد موارد واضحة — مؤشر خطة تدقيق ذات قيمة مؤسسية حقيقية.",
    category: "success_indicator", confidence: 90, sourceType: "institutional",
  },

  // ── PROSECUTOR — s1_case_review ─────────────────────────────────────────────
  {
    sectorId: "law_enforcement", professionId: "prosecutor", stageId: "s1_case_review",
    title: "اختبار 'مبدأ الشك المعقول' مبكراً",
    content: "المدعون العامون الخبراء يُطبّقون اختبار 'هل هذه الأدلة كافية لإدانة معقولة' قبل المضي في الملاحقة. هذا الاختبار يوفّر موارد المحكمة ويحمي المتهم من ملاحقة غير مبررة.",
    category: "expert_practice", confidence: 93, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "prosecutor", stageId: "s1_case_review",
    title: "الاعتماد على اعتراف وحيد دون دليل تعزيزي",
    content: "الاعتراف — حتى الطوعي — يجب أن يُعزَّز بأدلة مادية أو شهادات مستقلة. الاعتراف الوحيد في الممارسة الإماراتية والمقارنة قد لا يكفي وحده للإدانة.",
    category: "frequent_mistake", confidence: 92, sourceType: "institutional",
  },
  {
    sectorId: "law_enforcement", professionId: "prosecutor", stageId: "s1_case_review",
    title: "توثيق قرار الحفظ لا يقل أهمية عن قرار الاتهام",
    content: "قرارات حفظ القضية يجب أن تكون موثقة التسبيب بنفس مستوى قرارات الاتهام. ملف محفوظ بلا تسبيب يُشكّل خطراً قانونياً إذا طُعن في القرار.",
    category: "lesson_learned", confidence: 88, sourceType: "institutional",
  },
];

export async function seedInstitutionalMemory(): Promise<void> {
  // Always do per-entry checks (no count-based shortcut that could skip valid inserts)
  let inserted = 0;

  for (const entry of SEED_ENTRIES) {
    const existsResult = await db.execute<{ n: string }>(
      sql`SELECT COUNT(*)::text AS n
          FROM pgf_institutional_memory
          WHERE sector_id     = ${entry.sectorId}
            AND profession_id = ${entry.professionId}
            AND stage_id      = ${entry.stageId}
            AND title         = ${entry.title}`,
    );
    if (parseInt(existsResult.rows[0]?.n ?? "0", 10) > 0) continue;

    await db.insert(pgfInstitutionalMemoryTable).values(entry);
    inserted++;
  }

  logger.info(`PGF institutional memory seed: ${inserted} entries inserted`);
}
