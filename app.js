const sb = supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);

let currentUser = null;
let currentProfile = null;
let teachers = [], departments = [], subjects = [], criteria = [], visits = [], ratings = [], feedback = [], visitSkills = [], studentWork = [], supports = [], supportFollowups = [], profiles = [], teacherSubjects = [];
let editingVisitId = null;
let charts = {};
let reportNarrativeDraft = { summary: "", recommendations: "" };

const REPORT_INFO = {
  preparedBy: "فاتن صلاح",
  assistantPrincipal: "خلود الكعبي",
  principal: "أحلام السويدي"
};

const SCHOOL_HEADER_IMAGE = "school-header.jpg";

const EVALUATION_KEYS = [
  1, 2, 6, 9, 10, 11, 14, 16, 18
];

const FLEXIBLE_KEYS = [
  6, 11, 14, 16, 18
];

const SKILLS = [
  ["critical_thinking", "التفكير الناقد وحل المشكلات"],
  ["collaboration_communication", "التعاون والتواصل"],
  ["creativity_innovation", "الإبداع والابتكار"],
  ["information_literacy", "المعرفة المعلوماتية"],
  ["digital_literacy", "المعرفة الرقمية"],
  ["global_cultural_awareness", "الوعي العالمي والثقافي"],
  ["adaptability_flexibility", "القدرة على التكيف والمرونة"],
  ["emotional_intelligence", "الذكاء العاطفي"]
];

const WORK_ITEMS = [
  [
    "activities_alignment",
    "ملاءمة الأنشطة ومقدارها ونوعها واتساقها مع مخرجات المنهج"
  ],
  [
    "differentiated_levels",
    "مراعاة الفروق والمستويات الأكاديمية"
  ],
  [
    "higher_thinking_research_selflearning",
    "التفكير الأعلى والبحث والاستقصاء والتعلم الذاتي"
  ],
  [
    "regular_correction",
    "انتظام التصحيح"
  ],
  [
    "constructive_feedback",
    "التغذية الراجعة البناءة وتقدير الأعمال المتميزة"
  ]
];

/* =========================================================
   HELPERS
========================================================= */

const $ = id =>
  document.getElementById(id);

const esc = (v = "") =>
  String(v ?? "").replace(
    /[&<>"']/g,
    m =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[m])
  );

const num = v =>
  Number(v || 0);

const pct = (a, b) =>
  b
    ? Math.round(
        a / b * 100
      )
    : 0;

const monthKey = d =>
  String(
    d || ""
  ).slice(
    0,
    7
  );

const monthNames = {
  "01": "يناير",
  "02": "فبراير",
  "03": "مارس",
  "04": "أبريل",
  "05": "مايو",
  "06": "يونيو",
  "07": "يوليو",
  "08": "أغسطس",
  "09": "سبتمبر",
  "10": "أكتوبر",
  "11": "نوفمبر",
  "12": "ديسمبر"
};

const monthLabel = k =>
  k
    ? `${monthNames[k.slice(5, 7)] || k.slice(5, 7)} ${k.slice(0, 4)}`
    : "";

const formatDate = d =>
  d
    ? new Date(
        `${d}T00:00:00`
      ).toLocaleDateString(
        "ar-BH"
      )
    : "—";

const ratingShort = r =>
  ({
    4: "يتجاوز التوقعات بكثير",
    3: "يتجاوز التوقعات",
    2: "يفي بالتوقعات تمامًا",
    1: "يفي بالتوقعات جزئيًا"
  }[num(r)] || "—");

const ratingLabel = r =>
  ({
    4: "يتجاوز التوقعات بكثير",
    3: "يتجاوز التوقعات",
    2: "يفي بالتوقعات تمامًا",
    1: "يفي بالتوقعات جزئيًا"
  }[num(r)] || "—");

/* =========================================================
   القيادة
========================================================= */

function leadershipLevel(
  profile
) {
  if (!profile) {
    return "لا ينطبق";
  }

  if (
    profile.leadership_level ===
      "قيادة عليا" ||
    profile.leadership_level ===
      "قيادة وسطى"
  ) {
    return profile.leadership_level;
  }

  if (
    profile.job_title ===
      "مديرة المدرسة" ||
    profile.job_title ===
      "مديرة مساعدة"
  ) {
    return "قيادة عليا";
  }

  if (
    profile.job_title ===
    "منسقة قسم"
  ) {
    return "قيادة وسطى";
  }

  return "لا ينطبق";
}

function evaluatorForVisit(
  visit
) {
  return (
    profiles.find(
      profile =>
        String(
          profile.id
        ) ===
        String(
          visit?.observer_id
        )
    ) ||
    (
      String(
        visit?.observer_id
      ) ===
      String(
        currentProfile?.id
      )
        ? currentProfile
        : null
    )
  );
}

function evaluatorName(
  visit
) {
  return (
    evaluatorForVisit(
      visit
    )?.full_name ||
    "—"
  );
}

function evaluatorLevel(
  visit
) {
  return leadershipLevel(
    evaluatorForVisit(
      visit
    )
  );
}

/* =========================================================
   MAPS
========================================================= */

function maps() {
  return {
    teachers:
      Object.fromEntries(
        teachers.map(
          item => [
            String(
              item.id
            ),
            item
          ]
        )
      ),

    departments:
      Object.fromEntries(
        departments.map(
          item => [
            String(
              item.id
            ),
            item
          ]
        )
      ),

    subjects:
      Object.fromEntries(
        subjects.map(
          item => [
            String(
              item.id
            ),
            item
          ]
        )
      )
  };
}

function activeRows(
  rows
) {
  return rows.filter(
    item =>
      item.active !== false
  );
}

/* =========================================================
   SESSION
========================================================= */

async function ensureSession() {
  const {
    data,
    error
  } =
    await sb.auth.getSession();

  if (error) {
    throw error;
  }

  if (
    !data?.session?.user
  ) {
    location.href =
      "index.html";

    return false;
  }

  currentUser =
    data.session.user;

  return true;
}

async function loadCurrentProfile() {
  const {
    data,
    error
  } =
    await sb
      .from(
        "profiles"
      )
      .select("*")
      .eq(
        "id",
        currentUser.id
      )
      .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "لم يتم العثور على ملف المستخدم."
    );
  }

  if (
    data.active === false
  ) {
    throw new Error(
      "هذا الحساب غير نشط."
    );
  }

  currentProfile =
    data;
}

/* =========================================================
   LOAD DATA
========================================================= */

async function loadAll() {
  // V10.8: restore the original shared platform visibility for leadership/coordinators.
  // Role-specific admin controls remain protected by .admin-only; analytical data is loaded for signed-in users.

  const req =
    await Promise.all([
      sb
        .from("teachers")
        .select("*")
        .order(
          "full_name"
        ),

      sb
        .from("departments")
        .select("*")
        .order(
          "id"
        ),

      sb
        .from("criteria")
        .select("*")
        .order(
          "display_order"
        ),

      sb
        .from("visits")
        .select("*")
        .eq(
          "academic_year",
          APP_CONFIG.academicYear
        )
        .order(
          "visit_date",
          {
            ascending: false
          }
        ),

      sb
        .from(
          "visit_criteria"
        )
        .select("*"),

      sb
        .from(
          "visit_feedback"
        )
        .select("*"),

      sb
        .from(
          "visit_skills"
        )
        .select("*"),

      sb
        .from(
          "student_work_followup"
        )
        .select("*"),

      sb
        .from(
          "support_actions"
        )
        .select("*")
        .order(
          "support_date",
          {
            ascending: false
          }
        ),

      sb
        .from(
          "support_followups"
        )
        .select("*"),

      sb
        .from(
          "profiles"
        )
        .select("*")
        .order(
          "created_at"
        )
    ]);

  const error =
    req.find(
      item =>
        item.error
    )?.error;

  if (error) {
    throw error;
  }

  [
    teachers,
    departments,
    criteria,
    visits,
    ratings,
    feedback,
    visitSkills,
    studentWork,
    supports,
    supportFollowups,
    profiles
  ] =
    req.map(
      item =>
        item.data || []
    );

  // V10.9: load the live subject catalogue from Supabase first.
  // This is the source of truth for department/subject relationships.
  // Keep the verified historical map only as a read-only fallback if the table cannot be read.
  try {
    const subjectReq = await sb
      .from("subjects")
      .select("*")
      .order("name");
    subjects = subjectReq.error
      ? buildVerifiedSubjectRows(visits)
      : (subjectReq.data || []);
  } catch (_) {
    subjects = buildVerifiedSubjectRows(visits);
  }

  // V6: teacher_subjects is an optional extension table. The platform remains
  // operational before the migration is applied and uses the verified school map below.
  try {
    const tsReq = await sb.from("teacher_subjects").select("*");
    teacherSubjects = tsReq.error ? [] : (tsReq.data || []);
  } catch (_) {
    teacherSubjects = [];
  }
}

/* =========================================================
   SELECTS
========================================================= */

function setOptions(
  id,
  rows,
  placeholder,
  label = "name"
) {
  const element =
    $(id);

  if (!element) {
    return;
  }

  const old =
    element.value;

  element.innerHTML =
    `
      <option value="">
        ${esc(
          placeholder
        )}
      </option>
    `
    +
    rows
      .map(
        item => `
          <option
            value="${esc(
              item.id
            )}"
          >
            ${esc(
              item[label]
            )}
          </option>
        `
      )
      .join("");

  if (
    [...element.options]
      .some(
        option =>
          option.value ===
          old
      )
  ) {
    element.value =
      old;
  }
}

function availableMonths() {
  return [
    ...new Set(
      visits
        .map(
          visit =>
            monthKey(
              visit.visit_date
            )
        )
        .filter(
          Boolean
        )
    )
  ]
    .sort()
    .reverse();
}

function populateMonthSelectors() {
  const months =
    availableMonths();

  [
    [
      "histMonth",
      "كل الشهور"
    ],

    [
      "monthlyMonth",
      "اختاري الشهر"
    ],

    [
      "reportMonth",
      "اختاري الشهر"
    ]
  ]
    .forEach(
      (
        [
          id,
          placeholder
        ]
      ) => {
        const element =
          $(id);

        if (!element) {
          return;
        }

        const old =
          element.value;

        element.innerHTML =
          `
            <option value="">
              ${placeholder}
            </option>
          `
          +
          months
            .map(
              month => `
                <option
                  value="${month}"
                >
                  ${monthLabel(
                    month
                  )}
                </option>
              `
            )
            .join("");

        if (
          old &&
          months.includes(
            old
          )
        ) {
          element.value =
            old;
        }
        else if (
          id !==
            "histMonth" &&
          months[0]
        ) {
          element.value =
            months[0];
        }
      }
    );
}

function uniqueSubjectsByName(rows) {
  const seen = new Set();
  return (rows || []).filter(subject => {
    const key = v6Norm(subject?.name || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateSubjectSelect(
  selected = ""
) {
  const departmentId =
    $("departmentSelect")
      ?.value ||
    "";

  const selectedDepartment = departments.find(
    department => String(department.id) === String(departmentId)
  );

  // Special-education departments teach across the school curriculum, so all
  // active subjects must be available. Other departments only see their own
  // configured subjects from public.subjects.
  const allActiveSubjects = activeRows(subjects);
  const rows = uniqueSubjectsByName(
    v6IsSpecialDeptName(selectedDepartment?.name || "")
      ? allActiveSubjects
      : allActiveSubjects.filter(
          subject => String(subject.department_id) === String(departmentId)
        )
  );

  setOptions(
    "subjectSelect",
    rows,
    "اختاري المادة",
    "name"
  );

  if (
    $("subjectSelect")
  ) {
    $("subjectSelect").disabled =
      !departmentId;

    if (selected) {
      $("subjectSelect").value =
        String(
          selected
        );
    }
  }
}

/* =========================================================
   منفذ الزيارة
========================================================= */

function populateObserverSelector() {
  const element =
    $("visitObserverSelect");

  if (!element) {
    return;
  }

  const candidates =
    profiles.filter(
      profile =>
        profile.active !==
          false &&
        (
          leadershipLevel(
            profile
          ) !==
            "لا ينطبق" ||
          profile.role ===
            "admin"
        )
    );

  element.innerHTML =
    `
      <option value="">
        اختاري منفذ الزيارة
      </option>
    `
    +
    candidates
      .map(
        profile => `
          <option
            value="${esc(
              profile.id
            )}"
          >
            ${esc(
              profile.full_name
            )}
            —
            ${esc(
              profile.job_title ||
              leadershipLevel(
                profile
              )
            )}
          </option>
        `
      )
      .join("");

  if (
    currentProfile?.role !==
    "admin"
  ) {
    element.value =
      currentProfile?.id ||
      "";
  }
}

function selectedObserverProfile() {
  if (
    currentProfile?.role !==
    "admin"
  ) {
    return currentProfile;
  }

  const id =
    $("visitObserverSelect")
      ?.value;

  return (
    profiles.find(
      profile =>
        String(
          profile.id
        ) ===
        String(
          id
        )
    ) ||
    currentProfile
  );
}

function updateEvaluatorBlock() {
  const profile =
    selectedObserverProfile();

  if (
    $("visitEvaluatorName")
  ) {
    $("visitEvaluatorName").textContent =
      profile?.full_name ||
      "—";
  }

  if (
    $("visitEvaluatorLevel")
  ) {
    $("visitEvaluatorLevel").textContent =
      leadershipLevel(
        profile
      );
  }

  if (
    $("adminEvaluatorChooser")
  ) {
    $("adminEvaluatorChooser")
      .classList
      .toggle(
        "hidden",
        currentProfile?.role !==
          "admin"
      );
  }
}

/* =========================================================
   الدعم متعدد المعايير
========================================================= */

function renderSupportCriteriaMulti() {
  const box =
    $("supportCriteriaMulti");

  if (!box) {
    return;
  }

  box.innerHTML =
    criteria
      .map(
        criterion => `
          <label class="check-card">

            <input
              type="checkbox"
              class="support-criterion-check"
              value="${criterion.id}"
            >

            <span>
              <strong>
                م${criterion.id}
              </strong>
              —
              ${esc(
                criterion.criterion_text
              )}
            </span>

          </label>
        `
      )
      .join("");
}

function selectedSupportCriteria() {
  return [
    ...document
      .querySelectorAll(
        ".support-criterion-check:checked"
      )
  ]
    .map(
      item =>
        num(
          item.value
        )
    )
    .filter(
      Boolean
    );
}

/* =========================================================
   FILL UI
========================================================= */

function fillUI() {
  setOptions(
    "teacherSelect",
    activeRows(
      teachers
    ),
    "اختاري المعلمة",
    "full_name"
  );

  setOptions(
    "departmentSelect",
    activeRows(
      departments
    ),
    "اختاري القسم",
    "name"
  );

  setOptions(
    "histTeacher",
    activeRows(
      teachers
    ),
    "كل المعلمات",
    "full_name"
  );

  setOptions(
    "histDept",
    activeRows(
      departments
    ),
    "كل الأقسام",
    "name"
  );

  setOptions(
    "histSubject",
    uniqueSubjectsByName(activeRows(subjects)),
    "كل المواد",
    "name"
  );

  setOptions(
    "supportTeacherFilter",
    activeRows(
      teachers
    ),
    "كل المعلمات",
    "full_name"
  );

  setOptions(
    "newSubjectDept",
    activeRows(
      departments
    ),
    "اختاري القسم",
    "name"
  );

  setOptions(
    "newTeacherDept",
    activeRows(departments),
    "اختاري القسم",
    "name"
  );

  renderTeacherDepartmentManager();

  populateMonthSelectors();

  populateAnalysisSelectors();

  populateObserverSelector();

  renderSupportCriteriaMulti();

  renderCriteria();

  updateSubjectSelect();

  updateEvaluatorBlock();
}

/* =========================================================
   CRITERIA
========================================================= */

function renderCriteria() {
  const box =
    $("criteriaContainer");

  if (!box) {
    return;
  }

  const domains =
    [
      ...new Set(
        criteria.map(
          criterion =>
            criterion.domain_name
        )
      )
    ];

  box.innerHTML =
    domains
      .map(
        domain => `
          <section
            class="criteria-domain"
          >

            <h3>
              ${esc(
                domain
              )}
            </h3>

            <div>

              ${
                criteria
                  .filter(
                    criterion =>
                      criterion.domain_name ===
                      domain
                  )
                  .map(
                    criterion => `
                      <div
                        class="criterion"
                      >

                        <div>

                          <strong>
                            م${criterion.id}
                          </strong>

                          —

                          ${esc(
                            criterion.criterion_text
                          )}

                          ${
                            criterion.is_evaluation_key
                              ? `
                                  <span class="key">
                                    مفتاح تقييم
                                  </span>
                                `
                              : ""
                          }

                        </div>

                        <div
                          class="criterion-radios"
                        >

                          ${
                            [
                              4,
                              3,
                              2,
                              1
                            ]
                              .map(
                                rating => `
                                  <label>

                                    <input
                                      type="radio"
                                      name="criterion_${criterion.id}"
                                      value="${rating}"
                                    >

                                    ${ratingShort(
                                      rating
                                    )}

                                  </label>
                                `
                              )
                              .join("")
                          }

                        </div>

                        <textarea
                          id="criterionNote_${criterion.id}"
                          placeholder="ملاحظة اختيارية"
                        ></textarea>

                      </div>
                    `
                  )
                  .join("")
              }

            </div>

          </section>
        `
      )
      .join("");
}

function collectCriterionRatings() {
  const out = {};

  criteria.forEach(
    criterion => {
      const checked =
        document.querySelector(
          `input[name="criterion_${criterion.id}"]:checked`
        );

      out[
        num(
          criterion.id
        )
      ] =
        checked
          ? num(
              checked.value
            )
          : null;
    }
  );

  return out;
}

/* =========================================================
   CONSISTENCY
========================================================= */

function allowedAtBase(
  value,
  base
) {
  value =
    num(
      value
    );

  base =
    num(
      base
    );

  if (
    !value ||
    !base
  ) {
    return false;
  }

  if (
    base === 4
  ) {
    return (
      value === 4
    );
  }

  return (
    value ===
      base ||
    value ===
      base + 1
  );
}

function consistencyForRatings(
  ratingsMap,
  overall = null
) {
  const requiredKeys = [1, 2, 9, 10];

  const missing =
    requiredKeys.filter(
      key =>
        !num(
          ratingsMap[key]
        )
    );

  if (
    missing.length
  ) {
    return {
      complete: false,
      consistent: false,
      status: "غير مكتمل",
      messages: [
        `استكملي المعايير اللازمة لفحص الاتساق: ${missing.map(key => `م${key}`).join("، ")}`
      ],
      expectedOverall: null
    };
  }

  const base =
    Math.min(
      num(ratingsMap[1]),
      num(ratingsMap[2])
    );

  const messages = [];

  if (
    num(ratingsMap[9]) >
    base
  ) {
    messages.push(
      `المعيار م9 لا يجوز أن يكون أعلى من الأقل بين م1 وم2 (${ratingShort(base)}). ويمكن أن يساويه أو يكون أقل منه.`
    );
  }

  if (
    num(ratingsMap[10]) >
    base
  ) {
    messages.push(
      `المعيار م10 لا يجوز أن يكون أعلى من الأقل بين م1 وم2 (${ratingShort(base)}). ويمكن أن يساويه أو يكون أقل منه.`
    );
  }

  return {
    complete: true,
    consistent:
      messages.length === 0,
    status:
      messages.length
        ? "يحتاج مراجعة"
        : "متسق",
    messages,
    expectedOverall: null,
    base
  };
}

function ratingsForVisit(
  visitId
) {
  return ratings.filter(
    rating =>
      String(
        rating.visit_id
      ) ===
      String(
        visitId
      )
  );
}

function ratingMapForVisit(
  visitId
) {
  return Object.fromEntries(
    ratingsForVisit(
      visitId
    )
      .map(
        rating => [
          num(
            rating.criterion_no
          ),
          num(
            rating.rating
          )
        ]
      )
  );
}

function consistencyForVisit(
  visit
) {
  return consistencyForRatings(
    ratingMapForVisit(
      visit.id
    ),
    visit.overall_rating
  );
}

function updateConsistencyHint() {
  const element =
    $("consistencyHint");

  if (!element) {
    return;
  }

  const result =
    consistencyForRatings(
      collectCriterionRatings(),
      $("overallRating")
        ?.value ||
      null
    );

  if (
    !result.complete
  ) {
    element.className =
      "message";

    element.textContent =
      result.messages[0];

    return;
  }

  element.className =
    `message ${
      result.consistent
        ? "success"
        : "warn"
    }`;

  element.innerHTML =
    result.consistent
      ? `
          ✓ اتساق الرصد صحيح: م9 وم10 لا يتجاوزان الأقل بين م1 وم2.
        `
      : `
          <strong>
            يحتاج مراجعة اتساق
          </strong>

          <ul>
            ${
              result.messages
                .map(
                  message =>
                    `<li>${esc(message)}</li>`
                )
                .join("")
            }
          </ul>
        `;
}

/* =========================================================
   ANALYTICS
========================================================= */

function dataSlice(
  rows
) {
  const ids =
    new Set(
      rows.map(
        visit =>
          String(
            visit.id
          )
      )
    );

  return ratings.filter(
    rating =>
      ids.has(
        String(
          rating.visit_id
        )
      )
  );
}

function distribution(
  values
) {
  const valid =
    values
      .map(
        num
      )
      .filter(
        value =>
          [
            1,
            2,
            3,
            4
          ].includes(
            value
          )
      );

  const counts = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
  };

  valid.forEach(
    value =>
      counts[
        value
      ]++
  );

  const total =
    valid.length;

  return {
    count:
      total,

    excellent:
      counts[4],

    good:
      counts[3],

    satisfactory:
      counts[2],

    inappropriate:
      counts[1],

    meetsRate:
      pct(
        counts[2] +
        counts[3] +
        counts[4],
        total
      ),

    exceedsRate:
      pct(
        counts[3] +
        counts[4],
        total
      ),

    inappropriateRate:
      pct(
        counts[1],
        total
      )
  };
}

function criterionStats(
  rows
) {
  const slice =
    dataSlice(
      rows
    );

  return criteria.map(
    criterion => ({
      id:
        num(
          criterion.id
        ),

      criterion_text:
        criterion.criterion_text,

      domain_name:
        criterion.domain_name,

      ...distribution(
        slice
          .filter(
            rating =>
              num(
                rating.criterion_no
              ) ===
              num(
                criterion.id
              )
          )
          .map(
            rating =>
              rating.rating
          )
      )
    })
  );
}

function domainStats(
  rows
) {
  const slice =
    dataSlice(
      rows
    );

  return [
    ...new Set(
      criteria.map(
        criterion =>
          criterion.domain_name
      )
    )
  ]
    .map(
      domain => {
        const ids =
          new Set(
            criteria
              .filter(
                criterion =>
                  criterion.domain_name ===
                  domain
              )
              .map(
                criterion =>
                  num(
                    criterion.id
                  )
              )
          );

        return {
          domain,

          ...distribution(
            slice
              .filter(
                rating =>
                  ids.has(
                    num(
                      rating.criterion_no
                    )
                  )
              )
              .map(
                rating =>
                  rating.rating
              )
          )
        };
      }
    );
}

function teacherCoverage(
  rows = visits,
  scope = {}
) {
  const activeTeacherIds =
    new Set(
      activeRows(
        teachers
      ).map(
        teacher =>
          String(
            teacher.id
          )
      )
    );

  const teacherId =
    scope.teacherId
      ? String(
          scope.teacherId
        )
      : "";

  const departmentId =
    scope.departmentId
      ? String(
          scope.departmentId
        )
      : "";

  const visitedIds =
    new Set(
      rows
        .map(
          visit =>
            String(
              visit.teacher_id
            )
        )
        .filter(
          id =>
            activeTeacherIds.has(
              id
            )
        )
    );

  if (
    teacherId
  ) {
    const active =
      activeTeacherIds.has(
        teacherId
      );

    const visited =
      visitedIds.has(
        teacherId
      );

    return {
      total:
        active
          ? 1
          : 0,

      visited:
        active &&
        visited
          ? 1
          : 0,

      remaining:
        active &&
        !visited
          ? 1
          : 0,

      rate:
        active
          ? (
              visited
                ? 100
                : 0
            )
          : 0,

      remainingTeachers:
        active &&
        !visited
          ? activeRows(
              teachers
            ).filter(
              teacher =>
                String(
                  teacher.id
                ) ===
                teacherId
            )
          : [],

      basis:
        "teacher"
    };
  }

  if (
    departmentId
  ) {
    const candidateIds =
      new Set(
        visits
          .filter(
            visit =>
              String(
                visit.department_id
              ) ===
              departmentId
          )
          .map(
            visit =>
              String(
                visit.teacher_id
              )
          )
          .filter(
            id =>
              activeTeacherIds.has(
                id
              )
          )
      );

    const scopedVisitedIds =
      new Set(
        rows
          .filter(
            visit =>
              String(
                visit.department_id
              ) ===
              departmentId
          )
          .map(
            visit =>
              String(
                visit.teacher_id
              )
          )
          .filter(
            id =>
              candidateIds.has(
                id
              )
          )
      );

    const remainingTeachers =
      activeRows(
        teachers
      ).filter(
        teacher =>
          candidateIds.has(
            String(
              teacher.id
            )
          ) &&
          !scopedVisitedIds.has(
            String(
              teacher.id
            )
          )
      );

    return {
      total:
        candidateIds.size,

      visited:
        scopedVisitedIds.size,

      remaining:
        Math.max(
          0,
          candidateIds.size -
          scopedVisitedIds.size
        ),

      rate:
        pct(
          scopedVisitedIds.size,
          candidateIds.size
        ),

      remainingTeachers,

      basis:
        "department-observed"
    };
  }

  const activeTeachers =
    activeRows(
      teachers
    );

  return {
    total:
      activeTeachers.length,

    visited:
      visitedIds.size,

    remaining:
      Math.max(
        0,
        activeTeachers.length -
        visitedIds.size
      ),

    rate:
      pct(
        visitedIds.size,
        activeTeachers.length
      ),

    remainingTeachers:
      activeTeachers.filter(
        teacher =>
          !visitedIds.has(
            String(
              teacher.id
            )
          )
      ),

    basis:
      "school"
  };
}

function consistencySummary(
  rows
) {
  const all =
    rows.map(
      consistencyForVisit
    );

  const consistent =
    all.filter(
      item =>
        item.consistent
    ).length;

  return {
    total:
      all.length,

    consistent,

    review:
      all.filter(
        item =>
          item.complete &&
          !item.consistent
      ).length,

    incomplete:
      all.filter(
        item =>
          !item.complete
      ).length,

    rate:
      pct(
        consistent,
        all.length
      )
  };
}

function leadershipVisitStats(
  rows
) {
  let upper = 0;
  let middle = 0;
  let other = 0;

  const details =
    new Map();

  rows.forEach(
    visit => {
      const profile =
        evaluatorForVisit(
          visit
        );

      const level =
        leadershipLevel(
          profile
        );

      if (
        level ===
        "قيادة عليا"
      ) {
        upper++;
      }
      else if (
        level ===
        "قيادة وسطى"
      ) {
        middle++;
      }
      else {
        other++;
      }

      const key =
        String(
          profile?.id ||
          visit.observer_id ||
          "unknown"
        );

      if (
        !details.has(
          key
        )
      ) {
        details.set(
          key,
          {
            id:
              key,

            name:
              profile?.full_name ||
              "—",

            level,

            job_title:
              profile?.job_title ||
              "—",

            count:
              0
          }
        );
      }

      details.get(
        key
      ).count++;
    }
  );

  return {
    total:
      rows.length,

    upper,

    middle,

    other,

    upperRate:
      pct(
        upper,
        rows.length
      ),

    middleRate:
      pct(
        middle,
        rows.length
      ),

    evaluators:
      details.size,

    evaluatorDetails:
      [
        ...details.values()
      ].sort(
        (
          a,
          b
        ) =>
          b.count -
          a.count
      )
  };
}

function skillsStats(
  rows
) {
  const ids =
    new Set(
      rows.map(
        visit =>
          String(
            visit.id
          )
      )
    );

  const related =
    visitSkills.filter(
      item =>
        ids.has(
          String(
            item.visit_id
          )
        )
    );

  return SKILLS.map(
    (
      [
        key,
        label
      ]
    ) => {
      const observed =
        related.filter(
          item =>
            item[
              key
            ] ===
            true
        ).length;

      return {
        key,

        label,

        total:
          related.length,

        observed,

        rate:
          pct(
            observed,
            related.length
          )
      };
    }
  );
}

function studentWorkStats(
  rows
) {
  const ids =
    new Set(
      rows.map(
        visit =>
          String(
            visit.id
          )
      )
    );

  const related =
    studentWork.filter(
      item =>
        ids.has(
          String(
            item.visit_id
          )
        )
    );

  return WORK_ITEMS.map(
    (
      [
        key,
        label
      ]
    ) => {
      const observed =
        related.filter(
          item =>
            item[
              key
            ] ===
            true
        ).length;

      return {
        key,

        label,

        total:
          related.length,

        observed,

        rate:
          pct(
            observed,
            related.length
          )
      };
    }
  );
}

function weakestCriteria(
  rows
) {
  return criterionStats(
    rows
  )
    .filter(
      item =>
        item.count
    )
    .sort(
      (
        a,
        b
      ) =>
        b.inappropriateRate -
        a.inappropriateRate
    )
    .slice(
      0,
      5
    );
}

function strongestCriteria(
  rows
) {
  return criterionStats(
    rows
  )
    .filter(
      item =>
        item.count
    )
    .sort(
      (
        a,
        b
      ) =>
        b.exceedsRate -
        a.exceedsRate
    )
    .slice(
      0,
      5
    );
}

function supportSummary(
  rows = supports
) {
  return {
    total:
      rows.length,

    open:
      rows.filter(
        item =>
          item.status ===
          "مفتوح"
      ).length,

    follow:
      rows.filter(
        item =>
          item.status ===
          "تحت المتابعة"
      ).length,

    closed:
      rows.filter(
        item =>
          item.status ===
          "مغلق"
      ).length
  };
}

/* =========================================================
   SUPPORT COMPARISON
========================================================= */

function changeInfo(
  before,
  after
) {
  const diff =
    num(
      after
    ) -
    num(
      before
    );

  if (
    diff > 0
  ) {
    return {
      label:
        "تحسن",

      className:
        "success"
    };
  }

  if (
    diff < 0
  ) {
    return {
      label:
        "تراجع",

      className:
        "danger"
    };
  }

  return {
    label:
      "استقرار",

    className:
      "warn"
  };
}

function nextVisitForSupport(
  support
) {
  const source =
    visits.find(
      visit =>
        String(
          visit.id
        ) ===
        String(
          support.source_visit_id
        )
    );

  if (!source) {
    return null;
  }

  const laterVisits =
    visits
      .filter(
        visit =>
          String(
            visit.teacher_id
          ) ===
            String(
              support.teacher_id
            ) &&
          String(
            visit.id
          ) !==
            String(
              source.id
            ) &&
          String(
            visit.visit_date
          ) >=
            String(
              source.visit_date
            )
      )
      .sort(
        (
          a,
          b
        ) =>
          String(
            a.visit_date
          )
            .localeCompare(
              String(
                b.visit_date
              )
            )
      );

  return (
    laterVisits[0] ||
    null
  );
}

function supportObservedRow(
  support
) {
  const source =
    visits.find(
      visit =>
        String(
          visit.id
        ) ===
        String(
          support.source_visit_id
        )
    );

  if (!source) {
    return null;
  }

  const follow =
    nextVisitForSupport(
      support
    );

  const before =
    ratingMapForVisit(
      source.id
    )[
      num(
        support.criterion_no
      )
    ] ||
    null;

  const after =
    follow
      ? (
          ratingMapForVisit(
            follow.id
          )[
            num(
              support.criterion_no
            )
          ] ||
          null
        )
      : null;

  return {
    source,

    follow,

    before,

    after,

    change:
      before &&
      after
        ? changeInfo(
            before,
            after
          )
        : null
  };
}


/* =========================================================
   ADVANCED CRITERIA DISTRIBUTION + GROWTH
========================================================= */

function monthRangeOptions(
  fromId,
  toId
) {
  const months =
    availableMonths()
      .slice()
      .sort();

  const from =
    $(fromId);

  const to =
    $(toId);

  if (from) {
    const old =
      from.value;

    from.innerHTML =
      `<option value="">أول شهر متاح</option>` +
      months
        .map(
          month =>
            `<option value="${month}">${esc(monthLabel(month))}</option>`
        )
        .join("");

    if (
      old &&
      months.includes(old)
    ) {
      from.value =
        old;
    }
  }

  if (to) {
    const old =
      to.value;

    to.innerHTML =
      `<option value="">آخر شهر متاح</option>` +
      months
        .map(
          month =>
            `<option value="${month}">${esc(monthLabel(month))}</option>`
        )
        .join("");

    if (
      old &&
      months.includes(old)
    ) {
      to.value =
        old;
    }
  }
}

function populateAnalysisSelectors() {
  [
    "dashboardDeptFilter",
    "monthlyDeptFilter",
    "overallDeptFilter",
    "reportDeptFilter"
  ].forEach(
    id =>
      setOptions(
        id,
        activeRows(departments),
        "المدرسة كاملة",
        "name"
      )
  );

  [
    "dashboardTeacherFilter",
    "monthlyTeacherFilter",
    "overallTeacherFilter",
    "reportTeacherFilter"
  ].forEach(
    id =>
      setOptions(
        id,
        activeRows(teachers),
        "كل المعلمات",
        "full_name"
      )
  );

  [
    ["dashboardFromMonth", "dashboardToMonth"],
    ["overallFromMonth", "overallToMonth"],
    ["reportFromMonth", "reportToMonth"]
  ].forEach(
    pair =>
      monthRangeOptions(
        pair[0],
        pair[1]
      )
  );
}

function filterVisitsByScope(
  sourceRows,
  options = {}
) {
  const departmentId =
    String(
      options.departmentId ||
      ""
    );

  const teacherId =
    String(
      options.teacherId ||
      ""
    );

  const fromMonth =
    options.fromMonth ||
    "";

  const toMonth =
    options.toMonth ||
    "";

  return sourceRows.filter(
    visit => {
      const visitMonth =
        monthKey(
          visit.visit_date
        );

      if (
        departmentId &&
        String(
          visit.department_id
        ) !==
        departmentId
      ) {
        return false;
      }

      if (
        teacherId &&
        String(
          visit.teacher_id
        ) !==
        teacherId
      ) {
        return false;
      }

      if (
        fromMonth &&
        visitMonth <
        fromMonth
      ) {
        return false;
      }

      if (
        toMonth &&
        visitMonth >
        toMonth
      ) {
        return false;
      }

      return true;
    }
  );
}

function scopeLabel(
  departmentId,
  teacherId
) {
  const map =
    maps();

  if (
    teacherId
  ) {
    return (
      map.teachers[
        String(
          teacherId
        )
      ]?.full_name ||
      "المعلمة المحددة"
    );
  }

  if (
    departmentId
  ) {
    return (
      map.departments[
        String(
          departmentId
        )
      ]?.name ||
      "القسم المحدد"
    );
  }

  return "المدرسة كاملة";
}

function dashboardFilteredRows() {
  return filterVisitsByScope(
    visits,
    {
      departmentId:
        $("dashboardDeptFilter")
          ?.value ||
        "",

      teacherId:
        $("dashboardTeacherFilter")
          ?.value ||
        "",

      fromMonth:
        $("dashboardFromMonth")
          ?.value ||
        "",

      toMonth:
        $("dashboardToMonth")
          ?.value ||
        ""
    }
  );
}

function overallFilteredRows() {
  return filterVisitsByScope(
    visits,
    {
      departmentId:
        $("overallDeptFilter")
          ?.value ||
        "",

      teacherId:
        $("overallTeacherFilter")
          ?.value ||
        "",

      fromMonth:
        $("overallFromMonth")
          ?.value ||
        "",

      toMonth:
        $("overallToMonth")
          ?.value ||
        ""
    }
  );
}

function monthlyScopeRows(
  month
) {
  return filterVisitsByScope(
    visits,
    {
      departmentId:
        $("monthlyDeptFilter")
          ?.value ||
        "",

      teacherId:
        $("monthlyTeacherFilter")
          ?.value ||
        "",

      fromMonth:
        month,

      toMonth:
        month
    }
  );
}

function monthlyGrowthRows(
  selectedMonth
) {
  const filtered =
    filterVisitsByScope(
      visits,
      {
        departmentId:
          $("monthlyDeptFilter")
            ?.value ||
          "",

        teacherId:
          $("monthlyTeacherFilter")
            ?.value ||
          ""
      }
    );

  const months =
    [
      ...new Set(
        filtered
          .map(
            visit =>
              monthKey(
                visit.visit_date
              )
          )
          .filter(Boolean)
      )
    ]
      .sort();

  const index =
    months.indexOf(
      selectedMonth
    );

  if (
    index <= 0
  ) {
    return filtered.filter(
      visit =>
        monthKey(
          visit.visit_date
        ) ===
        selectedMonth
    );
  }

  const previous =
    months[
      index - 1
    ];

  return filtered.filter(
    visit => {
      const month =
        monthKey(
          visit.visit_date
        );

      return (
        month ===
          previous ||
        month ===
          selectedMonth
      );
    }
  );
}

function ratingLevelName(
  rating
) {
  return ({
    1: "يفي بالتوقعات جزئيًا",
    2: "يفي بالتوقعات تمامًا",
    3: "يتجاوز التوقعات",
    4: "يتجاوز التوقعات بكثير"
  })[num(rating)] || "—";
}

function criterionMonthlyDistribution(
  rows,
  criterionId
) {
  const visitIds =
    new Set(
      rows.map(
        visit =>
          String(
            visit.id
          )
      )
    );

  const values =
    ratings
      .filter(
        item =>
          visitIds.has(
            String(
              item.visit_id
            )
          ) &&
          num(
            item.criterion_no
          ) ===
          num(
            criterionId
          )
      )
      .map(
        item =>
          num(
            item.rating
          )
      )
      .filter(
        value =>
          value >= 1 &&
          value <= 4
      );

  const counts = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
  };

  values.forEach(
    value =>
      counts[value]++
  );

  const total =
    values.length;

  const percentages = {};

  [
    1,
    2,
    3,
    4
  ].forEach(
    level => {
      percentages[level] =
        total
          ? Math.round(
              (
                counts[level] /
                total
              ) *
              1000
            ) / 10
          : null;
    }
  );

  if (!total) {
    return {
      total: 0,
      counts,
      percentages,
      modes: [],
      modeRate: null
    };
  }

  const maxCount =
    Math.max(
      ...Object.values(
        counts
      )
    );

  const modes =
    [
      1,
      2,
      3,
      4
    ].filter(
      level =>
        counts[level] ===
        maxCount
    );

  return {
    total,
    counts,
    percentages,
    modes,
    modeRate:
      Math.round(
        (
          maxCount /
          total
        ) *
        1000
      ) / 10
  };
}

function modalLevelText(
  stat
) {
  if (
    !stat ||
    !stat.total ||
    !stat.modes?.length
  ) {
    return "—";
  }

  const names = stat.modes
    .map(
      ratingLevelName
    )
    .join(" / ");

  return `${names} ${stat.modeRate}%`;
}

function distributionCenter(
  stat
) {
  if (
    !stat ||
    !stat.total
  ) {
    return null;
  }

  return [1, 2, 3, 4]
    .reduce(
      (
        total,
        level
      ) =>
        total +
        level *
          (stat.percentages[level] || 0),
      0
    ) / 100;
}

function compareMonthlyCriterion(
  fromStat,
  toStat
) {
  if (
    !fromStat?.total ||
    !toStat?.total
  ) {
    return {
      status: "بيانات غير كافية",
      className: "growth-na",
      detail: "لا تتوافر بيانات كافية للمقارنة بين الشهرين."
    };
  }

  const fromModes =
    fromStat.modes || [];
  const toModes =
    toStat.modes || [];

  const fromMin = Math.min(
    ...fromModes
  );
  const fromMax = Math.max(
    ...fromModes
  );
  const toMin = Math.min(
    ...toModes
  );
  const toMax = Math.max(
    ...toModes
  );

  if (
    toMin >
    fromMax
  ) {
    return {
      status: "تحسن",
      className: "growth-up",
      detail: `انتقل النمط الغالب من ${modalLevelText(fromStat)} إلى ${modalLevelText(toStat)}.`
    };
  }

  if (
    toMax <
    fromMin
  ) {
    return {
      status: "تراجع",
      className: "growth-down",
      detail: `انتقل النمط الغالب من ${modalLevelText(fromStat)} إلى ${modalLevelText(toStat)}.`
    };
  }

  const before =
    distributionCenter(
      fromStat
    );
  const after =
    distributionCenter(
      toStat
    );
  const change =
    after !== null &&
    before !== null
      ? after - before
      : 0;

  if (
    change > 0.001
  ) {
    return {
      status: "تحسن في التوزيع",
      className: "growth-up",
      detail: "ظل النمط الغالب ثابتًا أو متعادلًا، مع انتقال نسبي للتقديرات نحو مستويات أعلى."
    };
  }

  if (
    change < -0.001
  ) {
    return {
      status: "تراجع في التوزيع",
      className: "growth-down",
      detail: "ظل النمط الغالب ثابتًا أو متعادلًا، مع انتقال نسبي للتقديرات نحو مستويات أدنى."
    };
  }

  return {
    status: "استقرار",
    className: "growth-flat",
    detail: "لم يظهر تغير في اتجاه توزيع مستويات الحكم بين الشهرين."
  };
}

function criterionGrowthStats(
  rows
) {
  const months = [
    ...new Set(
      rows
        .map(
          visit =>
            monthKey(
              visit.visit_date
            )
        )
        .filter(Boolean)
    )
  ].sort();

  return criteria.map(
    criterion => {
      const monthly =
        months.map(
          month => {
            const monthRows =
              rows.filter(
                visit =>
                  monthKey(
                    visit.visit_date
                  ) ===
                  month
              );

            const stat =
              criterionMonthlyDistribution(
                monthRows,
                criterion.id
              );

            return {
              month,
              ...stat,
              modalText:
                modalLevelText(
                  stat
                )
            };
          }
        );

      const transitions = [];

      for (
        let i = 0;
        i < months.length - 1;
        i++
      ) {
        const from = monthly[i];
        const to = monthly[i + 1];
        const reading =
          compareMonthlyCriterion(
            from,
            to
          );

        transitions.push({
          fromMonth:
            months[i],
          toMonth:
            months[i + 1],
          ...reading
        });
      }

      return {
        id:
          num(
            criterion.id
          ),
        criterion_text:
          criterion.criterion_text,
        domain_name:
          criterion.domain_name,
        monthly,
        transitions
      };
    }
  );
}

function criteriaReading(
  rows,
  growthRows,
  label = ""
) {
  if (!rows.length) {
    return "لا توجد زيارات ضمن النطاق المحدد حتى الآن.";
  }

  const stats =
    criterionStats(
      rows
    ).filter(
      item =>
        item.count > 0
    );

  if (!stats.length) {
    return "لا توجد أرصاد معايير كافية لإصدار قراءة تحليلية.";
  }

  const growth =
    criterionGrowthStats(
      growthRows
    );

  const transitions =
    growth.flatMap(
      item =>
        (item.transitions || [])
          .filter(
            transition =>
              transition.status !==
              "بيانات غير كافية"
          )
          .map(
            transition => ({
              criterionId:
                item.id,
              ...transition
            })
          )
    );

  const improving =
    transitions.filter(
      item =>
        item.status.startsWith(
          "تحسن"
        )
    ).length;

  const declining =
    transitions.filter(
      item =>
        item.status.startsWith(
          "تراجع"
        )
    ).length;

  const stable =
    transitions.filter(
      item =>
        item.status ===
        "استقرار"
    ).length;

  const currentModes =
    criteria.map(
      criterion => {
        const stat =
          criterionMonthlyDistribution(
            rows,
            criterion.id
          );
        return {
          id: num(criterion.id),
          stat,
          center:
            distributionCenter(
              stat
            )
        };
      }
    ).filter(
      item =>
        item.stat.total > 0
    );

  const highest =
    currentModes.length
      ? [...currentModes]
          .sort(
            (a, b) =>
              b.center -
              a.center
          )[0]
      : null;

  const lowest =
    currentModes.length
      ? [...currentModes]
          .sort(
            (a, b) =>
              a.center -
              b.center
          )[0]
      : null;

  const parts = [];

  if (
    highest &&
    lowest
  ) {
    parts.push(
      `${label ? `في ${label}، ` : ""}ظهر أعلى نمط أداء في المعيار م${highest.id} عند ${modalLevelText(highest.stat)}، بينما ظهر أدنى نمط أداء في المعيار م${lowest.id} عند ${modalLevelText(lowest.stat)}.`
    );
  }

  if (
    transitions.length
  ) {
    parts.push(
      `عبر المقارنات الشهرية المتتالية للمعايير من م1 إلى م18، سُجلت ${improving} حالة تحسن، و${stable} حالة استقرار، و${declining} حالة تراجع.`
    );
  }
  else {
    parts.push(
      "لا تتوافر بيانات لشهرين متتاليين على الأقل لإصدار قراءة تطور زمنية."
    );
  }

  return parts.join(" ");
}

function heatCellStyle(
  level,
  rate
) {
  const value =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          rate || 0
        )
      )
    );

  const alpha =
    0.12 +
    (
      value /
      100
    ) *
    0.55;

  const rgb = {
    1: "190,70,70",
    2: "205,154,55",
    3: "72,145,112",
    4: "21,105,112"
  }[level] || "120,120,120";

  return `background:rgba(${rgb},${alpha.toFixed(2)});font-weight:700;text-align:center;`;
}

function criteriaDistributionTableHTML(
  rows
) {
  const stats =
    criterionStats(
      rows
    );

  const dStats =
    domainStats(
      rows
    );

  const domains = [
    ...new Set(
      criteria.map(
        criterion =>
          criterion.domain_name
      )
    )
  ];

  const body =
    domains.map(
      domain => {
        const domainCriteria =
          stats.filter(
            item =>
              item.domain_name ===
              domain
          );

        const domainRow =
          dStats.find(
            item =>
              item.domain ===
              domain
          );

        const dCount =
          domainRow?.count || 0;

        const d1 =
          pct(
            domainRow?.inappropriate || 0,
            dCount
          );

        const d2 =
          pct(
            domainRow?.satisfactory || 0,
            dCount
          );

        const d3 =
          pct(
            domainRow?.good || 0,
            dCount
          );

        const d4 =
          pct(
            domainRow?.excellent || 0,
            dCount
          );

        return `
          <tr class="domain-row">
            <td>
              <strong>
                ${esc(domain)}
              </strong>
            </td>

            <td>
              <strong>
                ${dCount || "—"}
              </strong>
            </td>

            <td style="${heatCellStyle(1,d1)}">
              ${dCount ? `${d1}%` : "—"}
            </td>

            <td style="${heatCellStyle(2,d2)}">
              ${dCount ? `${d2}%` : "—"}
            </td>

            <td style="${heatCellStyle(3,d3)}">
              ${dCount ? `${d3}%` : "—"}
            </td>

            <td style="${heatCellStyle(4,d4)}">
              ${dCount ? `${d4}%` : "—"}
            </td>
          </tr>

          ${
            domainCriteria.map(
              item => {
                const r1 =
                  pct(
                    item.inappropriate,
                    item.count
                  );

                const r2 =
                  pct(
                    item.satisfactory,
                    item.count
                  );

                const r3 =
                  pct(
                    item.good,
                    item.count
                  );

                const r4 =
                  pct(
                    item.excellent,
                    item.count
                  );

                return `
                  <tr>
                    <td>
                      <strong>
                        م${item.id}
                      </strong>
                      —
                      ${esc(
                        item.criterion_text
                      )}
                    </td>

                    <td>
                      ${item.count || "—"}
                    </td>

                    <td style="${heatCellStyle(1,r1)}">
                      ${item.count ? `${r1}%` : "—"}
                    </td>

                    <td style="${heatCellStyle(2,r2)}">
                      ${item.count ? `${r2}%` : "—"}
                    </td>

                    <td style="${heatCellStyle(3,r3)}">
                      ${item.count ? `${r3}%` : "—"}
                    </td>

                    <td style="${heatCellStyle(4,r4)}">
                      ${item.count ? `${r4}%` : "—"}
                    </td>
                  </tr>
                `;
              }
            ).join("")
          }
        `;
      }
    ).join("");

  return `
    <div class="criteria-table-wrap">

      <table class="criteria-distribution-table">

        <thead>

          <tr>
            <th>
              المجال / المعيار
            </th>

            <th>
              عدد الأرصاد
            </th>

            <th>
              يفي بالتوقعات جزئيًا
            </th>

            <th>
              يفي بالتوقعات تمامًا
            </th>

            <th>
              يتجاوز التوقعات
            </th>

            <th>
              يتجاوز التوقعات بكثير
            </th>
          </tr>

        </thead>

        <tbody>
          ${body}
        </tbody>

      </table>

    </div>

    <div
      class="scope-note"
      style="
        margin-top:8px;
        font-size:12px;
      "
    >
      كلما زادت شدة لون الخلية زادت نسبة ظهور مستوى الحكم داخل المعيار أو المجال.
    </div>
  `;
}

function growthSummaryHTML(
  growth
) {
  const transitions =
    growth.flatMap(
      item =>
        item.transitions || []
    ).filter(
      item =>
        item.status !==
        "بيانات غير كافية"
    );

  const improving =
    transitions.filter(
      item =>
        item.status.startsWith(
          "تحسن"
        )
    ).length;

  const stable =
    transitions.filter(
      item =>
        item.status ===
        "استقرار"
    ).length;

  const declining =
    transitions.filter(
      item =>
        item.status.startsWith(
          "تراجع"
        )
    ).length;

  return `
    <div class="growth-summary-grid">
      <div class="growth-summary-card">
        <span>مقارنات شهرية متاحة</span>
        <strong>${transitions.length}</strong>
      </div>
      <div class="growth-summary-card">
        <span>تحسن</span>
        <strong>${improving}</strong>
      </div>
      <div class="growth-summary-card">
        <span>استقرار</span>
        <strong>${stable}</strong>
      </div>
      <div class="growth-summary-card">
        <span>تراجع</span>
        <strong>${declining}</strong>
      </div>
    </div>
  `;
}

function criteriaGrowthTableHTML(
  rows
) {
  const growth =
    criterionGrowthStats(
      rows
    );

  const months = [
    ...new Set(
      rows
        .map(
          visit =>
            monthKey(
              visit.visit_date
            )
        )
        .filter(Boolean)
    )
  ].sort();

  if (
    months.length < 2
  ) {
    return `
      ${growthSummaryHTML(growth)}
      <p class="scope-note">
        يلزم وجود بيانات في شهرين على الأقل لقراءة التطور بين الفترات.
      </p>
    `;
  }

  let headers =
    "<th>المعيار</th>";

  months.forEach(
    (month, index) => {
      headers +=
        `<th>${esc(monthLabel(month))}<br><small>النمط الغالب</small></th>`;

      if (
        index <
        months.length - 1
      ) {
        headers +=
          `<th>قراءة التطور<br><small>${esc(monthLabel(month))} ← ${esc(monthLabel(months[index + 1]))}</small></th>`;
      }
    }
  );

  const body =
    growth.map(
      item => {
        const monthMap =
          Object.fromEntries(
            item.monthly.map(
              entry => [
                entry.month,
                entry
              ]
            )
          );

        const transitionMap =
          Object.fromEntries(
            item.transitions.map(
              entry => [
                `${entry.fromMonth}|${entry.toMonth}`,
                entry
              ]
            )
          );

        let cells = `
          <td>
            <strong>م${item.id}</strong>
            — ${esc(item.criterion_text)}
          </td>`;

        months.forEach(
          (month, index) => {
            const point =
              monthMap[month];

            cells += `
              <td>
                ${point?.total ? esc(point.modalText) : "—"}
              </td>`;

            if (
              index <
              months.length - 1
            ) {
              const transition =
                transitionMap[
                  `${month}|${months[index + 1]}`
                ];

              cells += `
                <td class="${transition?.className || "growth-na"}">
                  <strong>${esc(transition?.status || "بيانات غير كافية")}</strong>
                  ${transition?.detail ? `<div class="small">${esc(transition.detail)}</div>` : ""}
                </td>`;
            }
          }
        );

        return `<tr>${cells}</tr>`;
      }
    ).join("");

  return `
    ${growthSummaryHTML(growth)}
    <p class="scope-note">
      يعتمد التطور على المستوى الأكثر تكرارًا ونسبته لكل معيار في كل شهر، وتظهر قراءة مستقلة بين كل شهرين متتاليين. وعند ثبات أو تعادل النمط الغالب تُقرأ حركة التوزيع الكامل للمستويات الأربعة قبل تحديد الاتجاه.
    </p>
    <div class="criteria-table-wrap">
      <table class="criteria-growth-table">
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function criteriaIntelligenceHTML(
  distributionRows,
  growthRows,
  label = ""
) {
  return `
    <div class="criteria-reading-box">
      <strong>القراءة التحليلية:</strong>
      ${esc(
        criteriaReading(
          distributionRows,
          growthRows,
          label
        )
      )}
    </div>

    <h4>توزيع مستويات الأداء في المعايير م1–م18</h4>
    ${criteriaDistributionTableHTML(distributionRows)}

    <h4 style="margin-top:22px">تتبع النمو الشهري في المعايير م1–م18</h4>
    ${criteriaGrowthTableHTML(growthRows)}
  `;
}

function renderDashboardCriteriaAnalytics(
  rows
) {
  const root =
    $("dashboardCriteriaAnalytics");

  if (!root) {
    return;
  }

  const departmentId =
    $("dashboardDeptFilter")
      ?.value ||
    "";

  const teacherId =
    $("dashboardTeacherFilter")
      ?.value ||
    "";

  root.innerHTML =
    criteriaIntelligenceHTML(
      rows,
      rows,
      scopeLabel(
        departmentId,
        teacherId
      )
    );
}


/* =========================================================
   CHART HELPERS
========================================================= */

function destroyChart(
  id
) {
  if (
    charts[
      id
    ]
  ) {
    charts[
      id
    ].destroy();

    delete charts[
      id
    ];
  }
}

function makeChart(
  id,
  type,
  labels,
  data,
  label
) {
  const canvas =
    $(id);

  if (
    !canvas ||
    !window.Chart
  ) {
    return;
  }

  destroyChart(
    id
  );

  charts[
    id
  ] =
    new Chart(
      canvas,
      {
        type,

        data: {
          labels,

          datasets: [
            {
              label,
              data
            }
          ]
        },

        options: {
          responsive:
            true,

          maintainAspectRatio:
            false,

          plugins: {
            legend: {
              display:
                false
            }
          }
        }
      }
    );
}

function setKpi(
  id,
  value,
  sub = ""
) {
  const element =
    $(id);

  if (!element) {
    return;
  }

  const valueElement =
    element.querySelector(
      ".kpi-value"
    ) ||
    element.querySelector(
      "strong"
    );

  if (
    valueElement
  ) {
    valueElement.textContent =
      value;
  }

  const subElement =
    element.querySelector(
      ".kpi-sub"
    );

  if (
    subElement
  ) {
    subElement.textContent =
      sub;
  }
}

function listCards(
  items,
  renderer
) {
  return items.length
    ? items
        .map(
          renderer
        )
        .join("")
    : `
        <div class="empty-state">
          لا توجد بيانات كافية بعد.
        </div>
      `;
}

/* =========================================================
   DASHBOARD
========================================================= */


/* =========================================================
   DEPARTMENT PERFORMANCE READINGS
   قراءة تشغيلية داخلية حسب الأقسام
========================================================= */

function teacherPerformanceReading(teacherVisits) {
  const ordered = teacherVisits
    .filter(v => num(v.overall_rating) >= 1 && num(v.overall_rating) <= 4)
    .slice()
    .sort((a, b) => String(a.visit_date).localeCompare(String(b.visit_date)));

  if (!ordered.length) return null;

  if (ordered.length === 1) {
    return {
      key: "initial",
      label: "قراءة أولية – تحتاج زيارة متابعة"
    };
  }

  const levels = ordered.map(v => num(v.overall_rating));
  const latest = levels[levels.length - 1];
  const previous = levels[levels.length - 2];
  const levelOneCount = levels.filter(level => level === 1).length;

  if (latest === 1 || levelOneCount >= 2) {
    return {
      key: "priority",
      label: "أولوية للتحسين"
    };
  }

  if (latest >= 3 && previous >= 3 && latest >= previous) {
    return {
      key: "stableHigh",
      label: "أداء مرتفع ومستقر"
    };
  }

  return {
    key: "developing",
    label: "أداء نامٍ"
  };
}

function departmentPerformanceReadings(rows) {
  const map = maps();
  const departmentIds = [
    ...new Set(
      rows
        .map(visit => String(visit.department_id || ""))
        .filter(Boolean)
    )
  ];

  return departmentIds
    .map(departmentId => {
      const departmentRows = rows.filter(
        visit => String(visit.department_id) === departmentId
      );

      const teacherIds = [
        ...new Set(
          departmentRows
            .map(visit => String(visit.teacher_id || ""))
            .filter(Boolean)
        )
      ];

      const counts = {
        stableHigh: 0,
        developing: 0,
        priority: 0,
        initial: 0
      };

      teacherIds.forEach(teacherId => {
        const reading = teacherPerformanceReading(
          departmentRows.filter(
            visit => String(visit.teacher_id) === teacherId
          )
        );
        if (reading) counts[reading.key]++;
      });

      return {
        departmentId,
        departmentName:
          map.departments[departmentId]?.name || "قسم غير محدد",
        total: teacherIds.length,
        ...counts
      };
    })
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName, "ar"));
}

function departmentPerformanceReadingsHTML(rows, options = {}) {
  const data = departmentPerformanceReadings(rows);
  const compact = options.compact === true;

  if (!data.length) {
    return `
      <div class="empty-state">
        لا تتوافر بيانات زيارات كافية لإظهار قراءة مستويات الأداء حسب الأقسام.
      </div>
    `;
  }

  const totals = data.reduce(
    (acc, item) => {
      acc.stableHigh += item.stableHigh;
      acc.developing += item.developing;
      acc.priority += item.priority;
      acc.initial += item.initial;
      acc.total += item.total;
      return acc;
    },
    { stableHigh: 0, developing: 0, priority: 0, initial: 0, total: 0 }
  );

  return `
    <div class="department-performance-reading">
      ${
        compact
          ? ""
          : `
              <p class="analysis-note">
                قراءة تشغيلية مستندة إلى الزيارات المسجلة، وتُظهر عدد المعلمات المرصودات في كل قسم حسب مسار الأداء. لا تُعد حكمًا منفصلًا عن استمارة الزيارة الصفية.
              </p>
            `
      }

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>القسم</th>
              <th>أداء مرتفع ومستقر</th>
              <th>أداء نامٍ</th>
              <th>أولوية للتحسين</th>
              <th>قراءة أولية</th>
              <th>إجمالي المعلمات المرصودات</th>
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                item => `
                  <tr>
                    <td><strong>${esc(item.departmentName)}</strong></td>
                    <td>${item.stableHigh || "—"}</td>
                    <td>${item.developing || "—"}</td>
                    <td>${item.priority || "—"}</td>
                    <td>${item.initial || "—"}</td>
                    <td><strong>${item.total}</strong></td>
                  </tr>
                `
              )
              .join("")}
            <tr>
              <td><strong>المجموع الكلي</strong></td>
              <td><strong>${totals.stableHigh || "—"}</strong></td>
              <td><strong>${totals.developing || "—"}</strong></td>
              <td><strong>${totals.priority || "—"}</strong></td>
              <td><strong>${totals.initial || "—"}</strong></td>
              <td><strong>${totals.total}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}


/* =========================================================
   QUALITY CARD READINGS
   قراءات بطاقة الجودة
========================================================= */

function qualityNormalizeText(value = "") {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function qualitySubjectName(visit) {
  const subject =
    subjects.find(
      item =>
        String(item.id) ===
        String(visit?.subject_id)
    );

  return subject?.name || "";
}

function qualityIsBasicSubjectName(name) {
  const n = qualityNormalizeText(name);

  return [
    "اللغه العربيه",
    "عربي",
    "اللغه الانجليزيه",
    "انجليزي",
    "الرياضيات",
    "رياضيات",
    "العلوم",
    "علوم",
    "معلم الفصل",
    "نظام فصل"
  ].some(
    key =>
      n.includes(
        qualityNormalizeText(key)
      )
  );
}

function qualityRowsByBasicGroup(
  rows,
  basic = true
) {
  return rows.filter(
    visit => {
      const name =
        qualitySubjectName(
          visit
        );

      if (!name) {
        return false;
      }

      return (
        qualityIsBasicSubjectName(
          name
        ) ===
        basic
      );
    }
  );
}

function qualityMonthRows(
  rows,
  month
) {
  return rows.filter(
    visit =>
      monthKey(
        visit.visit_date
      ) ===
      month
  );
}

function qualityRatingShare(
  rows,
  acceptedLevels
) {
  const valid =
    rows.filter(
      visit =>
        [1, 2, 3, 4].includes(
          num(
            visit.overall_rating
          )
        )
    );

  if (!valid.length) {
    return {
      count: 0,
      total: 0,
      rate: null
    };
  }

  const count =
    valid.filter(
      visit =>
        acceptedLevels.includes(
          num(
            visit.overall_rating
          )
        )
    ).length;

  return {
    count,
    total:
      valid.length,
    rate:
      Math.round(
        count /
        valid.length *
        1000
      ) / 10
  };
}

function qualityGrowthReading(
  rows,
  basic,
  acceptedLevels
) {
  const scoped =
    qualityRowsByBasicGroup(
      rows,
      basic
    );

  const months = [
    ...new Set(
      scoped
        .map(
          visit =>
            monthKey(
              visit.visit_date
            )
        )
        .filter(Boolean)
    )
  ].sort();

  if (!months.length) {
    return {
      current: null,
      previous: null,
      change: null,
      currentMonth: "",
      previousMonth: ""
    };
  }

  const currentMonth =
    months[
      months.length - 1
    ];

  const previousMonth =
    months.length > 1
      ? months[
          months.length - 2
        ]
      : "";

  const current =
    qualityRatingShare(
      qualityMonthRows(
        scoped,
        currentMonth
      ),
      acceptedLevels
    );

  const previous =
    previousMonth
      ? qualityRatingShare(
          qualityMonthRows(
            scoped,
            previousMonth
          ),
          acceptedLevels
        )
      : null;

  const change =
    current.rate !== null &&
    previous &&
    previous.rate !== null
      ? Math.round(
          (
            current.rate -
            previous.rate
          ) *
          10
        ) / 10
      : null;

  return {
    current,
    previous,
    change,
    currentMonth,
    previousMonth
  };
}

function qualityGrowthValueHTML(
  reading,
  options = {}
) {
  const amountOnly =
    options.amountOnly === true;

  if (
    !reading?.current ||
    reading.current.rate === null
  ) {
    return `
      <strong>—</strong>
      <span>لا توجد بيانات كافية</span>
    `;
  }

  if (amountOnly) {
    return `
      <strong>
        ${reading.current.count}
        <small>
          (${reading.current.rate}%)
        </small>
      </strong>
      <span>
        ${esc(
          monthLabel(
            reading.currentMonth
          )
        )}
      </span>
    `;
  }

  const changeText =
    reading.change === null
      ? "لا توجد مقارنة بشهر سابق"
      : (
          reading.change > 0
            ? `ارتفاع ${reading.change} نقطة مئوية`
            : (
                reading.change < 0
                  ? `انخفاض ${Math.abs(reading.change)} نقطة مئوية`
                  : "استقرار دون تغير"
              )
        );

  return `
    <strong>
      ${reading.current.rate}%
    </strong>
    <span>
      ${esc(changeText)}
    </span>
  `;
}

function qualityFindCriterion(
  keywordGroups
) {
  return criteria.find(
    criterion => {
      const text =
        qualityNormalizeText(
          criterion.criterion_text
        );

      return keywordGroups.every(
        group =>
          group.some(
            keyword =>
              text.includes(
                qualityNormalizeText(
                  keyword
                )
              )
          )
      );
    }
  ) || null;
}

function qualityCriterionReading(
  rows,
  keywordGroups
) {
  const criterion =
    qualityFindCriterion(
      keywordGroups
    );

  if (!criterion) {
    return {
      criterion: null,
      total: 0,
      count: 0,
      rate: null
    };
  }

  const ids =
    new Set(
      rows.map(
        visit =>
          String(
            visit.id
          )
      )
    );

  const related =
    ratings.filter(
      rating =>
        ids.has(
          String(
            rating.visit_id
          )
        ) &&
        num(
          rating.criterion_no
        ) ===
        num(
          criterion.id
        ) &&
        [1, 2, 3, 4].includes(
          num(
            rating.rating
          )
        )
    );

  const count =
    related.filter(
      rating =>
        num(
          rating.rating
        ) >= 3
    ).length;

  return {
    criterion,
    total:
      related.length,
    count,
    rate:
      related.length
        ? Math.round(
            count /
            related.length *
            1000
          ) / 10
        : null
  };
}

function qualityCriterionValueHTML(
  reading
) {
  if (
    !reading?.criterion ||
    reading.rate === null
  ) {
    return `
      <strong>—</strong>
      <span>لا توجد بيانات كافية</span>
    `;
  }

  return `
    <strong>
      ${reading.rate}%
    </strong>
    <span>
      م${reading.criterion.id}
      •
      ${reading.count} من ${reading.total}
    </span>
  `;
}

function qualityImprovementByBasicSubject(
  rows
) {
  const basicRows =
    qualityRowsByBasicGroup(
      rows,
      true
    );

  const subjectMap =
    new Map();

  basicRows.forEach(
    visit => {
      const subjectName =
        qualitySubjectName(
          visit
        ) ||
        "مادة غير محددة";

      if (
        !subjectMap.has(
          subjectName
        )
      ) {
        subjectMap.set(
          subjectName,
          []
        );
      }

      subjectMap
        .get(
          subjectName
        )
        .push(
          visit
        );
    }
  );

  return [
    ...subjectMap.entries()
  ]
    .map(
      (
        [
          subjectName,
          subjectRows
        ]
      ) => {
        const teacherIds = [
          ...new Set(
            subjectRows
              .map(
                visit =>
                  String(
                    visit.teacher_id
                  )
              )
              .filter(Boolean)
          )
        ];

        let improved = 0;
        let comparable = 0;

        teacherIds.forEach(
          teacherId => {
            const teacherRows =
              subjectRows
                .filter(
                  visit =>
                    String(
                      visit.teacher_id
                    ) ===
                    teacherId &&
                    [1, 2, 3, 4].includes(
                      num(
                        visit.overall_rating
                      )
                    )
                )
                .slice()
                .sort(
                  (
                    a,
                    b
                  ) =>
                    String(
                      a.visit_date
                    ).localeCompare(
                      String(
                        b.visit_date
                      )
                    )
                );

            if (
              teacherRows.length < 2
            ) {
              return;
            }

            comparable++;

            const first =
              num(
                teacherRows[0]
                  .overall_rating
              );

            const last =
              num(
                teacherRows[
                  teacherRows.length - 1
                ].overall_rating
              );

            if (
              last > first
            ) {
              improved++;
            }
          }
        );

        return {
          subjectName,
          improved,
          comparable
        };
      }
    )
    .sort(
      (
        a,
        b
      ) =>
        a.subjectName.localeCompare(
          b.subjectName,
          "ar"
        )
    );
}

function qualitySupportBasicReading() {
  const basicSupport =
    supports
      .map(
        support => {
          const sourceVisit =
            visits.find(
              visit =>
                String(
                  visit.id
                ) ===
                String(
                  support.source_visit_id
                )
            );

          if (
            !sourceVisit ||
            !qualityIsBasicSubjectName(
              qualitySubjectName(
                sourceVisit
              )
            )
          ) {
            return null;
          }

          return {
            support,
            sourceVisit,
            observed:
              supportObservedRow(
                support
              )
          };
        }
      )
      .filter(Boolean);

  const supportedTeachers =
    new Set(
      basicSupport.map(
        item =>
          String(
            item.support.teacher_id
          )
      )
    );

  const improvedTeachers =
    new Set(
      basicSupport
        .filter(
          item =>
            item.observed?.change
              ?.label ===
            "تحسن"
        )
        .map(
          item =>
            String(
              item.support.teacher_id
            )
        )
    );

  return {
    supported:
      supportedTeachers.size,
    improved:
      improvedTeachers.size
  };
}

function qualityCardReadingsHTML(
  rows
) {
  const highBasic =
    qualityGrowthReading(
      rows,
      true,
      [3, 4]
    );

  const highNonBasic =
    qualityGrowthReading(
      rows,
      false,
      [3, 4]
    );

  const meetsBasic =
    qualityGrowthReading(
      rows,
      true,
      [2]
    );

  const meetsNonBasic =
    qualityGrowthReading(
      rows,
      false,
      [2]
    );

  const partialBasic =
    qualityGrowthReading(
      rows,
      true,
      [1]
    );

  const partialNonBasic =
    qualityGrowthReading(
      rows,
      false,
      [1]
    );

  const planning =
    qualityCriterionReading(
      rows,
      [
        ["تخطيط", "التخطيط"],
        ["موقف", "الموقف", "المواقف"]
      ]
    );

  const knowledgeSkills =
    qualityCriterionReading(
      rows,
      [
        ["معارف", "المعارف"],
        ["مهارات", "المهارات"]
      ]
    );

  const motivation =
    qualityCriterionReading(
      rows,
      [
        ["دافعيه", "الدافعيه", "دافعية"],
        ["مشاركه", "المشاركه", "مشاركة"]
      ]
    );

  const improvement =
    qualityImprovementByBasicSubject(
      rows
    );

  const support =
    qualitySupportBasicReading();

  const growthCell =
    reading => {
      if (
        !reading?.current ||
        reading.current.rate === null
      ) {
        return `
          <span style="color:#7a8b96;">
            —
          </span>
        `;
      }

      const change =
        reading.change === null
          ? "لا توجد مقارنة سابقة"
          : (
              reading.change > 0
                ? `↑ ${reading.change} نقطة`
                : (
                    reading.change < 0
                      ? `↓ ${Math.abs(reading.change)} نقطة`
                      : "ثبات"
                  )
            );

      return `
        <strong style="display:block;font-size:18px;color:#123f55;">
          ${reading.current.rate}%
        </strong>
        <small style="color:#6f7f89;">
          ${esc(change)}
        </small>
      `;
    };

  const amountCell =
    reading => {
      if (
        !reading?.current ||
        reading.current.rate === null
      ) {
        return "—";
      }

      return `
        <strong style="font-size:18px;color:#123f55;">
          ${reading.current.count}
        </strong>
        <span style="color:#6f7f89;">
          (${reading.current.rate}%)
        </span>
      `;
    };

  const criterionCell =
    reading => {
      if (
        !reading?.criterion ||
        reading.rate === null
      ) {
        return `
          <span style="color:#7a8b96;">
            لا توجد بيانات كافية
          </span>
        `;
      }

      return `
        <strong style="font-size:18px;color:#123f55;">
          ${reading.rate}%
        </strong>
        <small style="display:block;color:#6f7f89;">
          ${reading.count} من ${reading.total}
          • م${reading.criterion.id}
        </small>
      `;
    };

  const improvementRows =
    improvement.length
      ? improvement
          .map(
            item => `
              <tr>
                <td>
                  ${esc(item.subjectName)}
                </td>
                <td style="text-align:center;">
                  ${item.improved}
                </td>
                <td style="text-align:center;">
                  ${item.comparable}
                </td>
                <td style="text-align:center;">
                  ${
                    item.comparable
                      ? Math.round(
                          item.improved /
                          item.comparable *
                          1000
                        ) / 10
                      : 0
                  }%
                </td>
              </tr>
            `
          )
          .join("")
      : `
          <tr>
            <td
              colspan="4"
              style="text-align:center;color:#7a8b96;padding:18px;"
            >
              تحتاج القراءة إلى زيارتين على الأقل للمعلمة في المادة نفسها.
            </td>
          </tr>
        `;

  const tableStyle = `
    width:100%;
    border-collapse:separate;
    border-spacing:0;
    overflow:hidden;
    border:1px solid #d9e4e8;
    border-radius:14px;
    background:#fff;
  `;

  const thStyle = `
    background:#eef4f6;
    color:#173f53;
    font-weight:800;
    padding:13px 12px;
    border-bottom:1px solid #d9e4e8;
    text-align:center;
  `;

  const tdStyle = `
    padding:13px 12px;
    border-bottom:1px solid #edf2f4;
    vertical-align:middle;
  `;

  return `
    <div style="margin-top:16px;">
      <div style="margin-bottom:18px;">
        <h4 style="margin:0 0 10px;color:#143f54;">
          أولًا: مستويات الأداء في المواد الأساسية وغير الأساسية
        </h4>

        <div style="overflow-x:auto;">
          <table style="${tableStyle}">
            <thead>
              <tr>
                <th style="${thStyle};text-align:right;">
                  المؤشر
                </th>
                <th style="${thStyle}">
                  المواد الأساسية
                </th>
                <th style="${thStyle}">
                  المواد غير الأساسية
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td style="${tdStyle};font-weight:700;">
                  نمو مستوى «يتجاوز التوقعات» فأعلى
                </td>
                <td style="${tdStyle};text-align:center;">
                  ${growthCell(highBasic)}
                </td>
                <td style="${tdStyle};text-align:center;">
                  ${growthCell(highNonBasic)}
                </td>
              </tr>

              <tr>
                <td style="${tdStyle};font-weight:700;">
                  نمو مستوى «يفي بالتوقعات تمامًا»
                </td>
                <td style="${tdStyle};text-align:center;">
                  ${growthCell(meetsBasic)}
                </td>
                <td style="${tdStyle};text-align:center;">
                  ${growthCell(meetsNonBasic)}
                </td>
              </tr>

              <tr>
                <td style="${tdStyle};font-weight:700;">
                  مقدار مستوى «يفي بالتوقعات جزئيًا»
                </td>
                <td style="${tdStyle};text-align:center;">
                  ${amountCell(partialBasic)}
                </td>
                <td style="${tdStyle};text-align:center;">
                  ${amountCell(partialNonBasic)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <h4 style="margin:0 0 10px;color:#143f54;">
          ثانيًا: مؤشرات الممارسة الصفية
        </h4>

        <div style="overflow-x:auto;">
          <table style="${tableStyle}">
            <thead>
              <tr>
                <th style="${thStyle};text-align:right;">
                  المؤشر
                </th>
                <th style="${thStyle}">
                  القراءة
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td style="${tdStyle};font-weight:700;">
                  تخطيط الدروس وإدارة المواقف التعليمية بصورة منظمة
                </td>
                <td style="${tdStyle};text-align:center;">
                  ${criterionCell(planning)}
                </td>
              </tr>

              <tr>
                <td style="${tdStyle};font-weight:700;">
                  إظهار المتعلمين للمعارف والمهارات الأساسية المكتسبة
                </td>
                <td style="${tdStyle};text-align:center;">
                  ${criterionCell(knowledgeSkills)}
                </td>
              </tr>

              <tr>
                <td style="${tdStyle};font-weight:700;">
                  إثارة دافعية المتعلمين بما يحفز المشاركة في التعلم
                </td>
                <td style="${tdStyle};text-align:center;">
                  ${criterionCell(motivation)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <h4 style="margin:0 0 10px;color:#143f54;">
          ثالثًا: تطور أداء المعلمات في المواد الأساسية
        </h4>

        <p style="margin:0 0 10px;color:#6f7f89;font-size:13px;">
          يعتمد المؤشر على مقارنة أول وآخر زيارة متاحة للمعلمة في المادة نفسها، ولا تُحتسب المعلمة التي لا تتوافر لها زيارتان قابلتان للمقارنة.
        </p>

        <div style="overflow-x:auto;">
          <table style="${tableStyle}">
            <thead>
              <tr>
                <th style="${thStyle};text-align:right;">
                  المادة
                </th>
                <th style="${thStyle}">
                  تحسن إلى مستوى أعلى
                </th>
                <th style="${thStyle}">
                  قابل للمقارنة
                </th>
                <th style="${thStyle}">
                  نسبة التحسن
                </th>
              </tr>
            </thead>

            <tbody>
              ${improvementRows}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 style="margin:0 0 10px;color:#143f54;">
          رابعًا: الدعم والمساندة في المواد الأساسية
        </h4>

        <div style="overflow-x:auto;">
          <table style="${tableStyle}">
            <thead>
              <tr>
                <th style="${thStyle};text-align:right;">
                  المؤشر
                </th>
                <th style="${thStyle}">
                  العدد
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td style="${tdStyle};font-weight:700;">
                  المعلمات اللاتي تلقين دعمًا أو مساندة
                </td>
                <td style="${tdStyle};text-align:center;font-size:18px;font-weight:800;">
                  ${support.supported}
                </td>
              </tr>

              <tr>
                <td style="${tdStyle};font-weight:700;">
                  المعلمات اللاتي حققن تحسنًا في متابعة لاحقة
                </td>
                <td style="${tdStyle};text-align:center;font-size:18px;font-weight:800;">
                  ${support.improved}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style="margin:10px 2px 0;color:#7a8b96;font-size:12px;">
          مؤشرات «المعلمات المستجدات» و«الأولى بالرعاية» لن تُعرض بأرقام حتى نضيف هذا التصنيف رسميًا إلى بيانات المعلمات.
        </p>
      </div>
    </div>
  `;
}


function renderDashboardQualityCard(
  rows
) {
  const anchor =
    $("dashboardDepartmentPerformance");

  if (!anchor) {
    return;
  }

  let panel =
    $("dashboardQualityCardReadings");

  if (!panel) {
    panel =
      document.createElement(
        "article"
      );

    panel.id =
      "dashboardQualityCardReadings";

    panel.className =
      "panel strategic-panel";

    anchor.insertAdjacentElement(
      "afterend",
      panel
    );
  }

  panel.innerHTML = `
    <div class="panel-head">
      <div>
        <span class="panel-kicker">
          QUALITY CARD READINGS
        </span>
        <h3>
          قراءات بطاقة الجودة
        </h3>
        <p>
          مؤشرات آلية مستخلصة من الزيارات الصفية المسجلة لدعم المتابعة واتخاذ القرار.
        </p>
      </div>
    </div>

    ${qualityCardReadingsHTML(
      rows
    )}
  `;
}


function renderDashboardDepartmentPerformance(rows) {
  const anchor = $("dashboardCriteriaAnalytics")?.closest("article");
  if (!anchor) return;

  let panel = $("dashboardDepartmentPerformance");
  if (!panel) {
    panel = document.createElement("article");
    panel.id = "dashboardDepartmentPerformance";
    panel.className = "panel strategic-panel";
    anchor.insertAdjacentElement("afterend", panel);
  }

  panel.innerHTML = `
    <div class="panel-head">
      <div>
        <span class="panel-kicker">DEPARTMENT PERFORMANCE READINGS</span>
        <h3>قراءة مستويات الأداء حسب الأقسام</h3>
        <p>توزيع المعلمات المرصودات وفق مسار الأداء المستخلص من الزيارات المسجلة.</p>
      </div>
    </div>
    ${departmentPerformanceReadingsHTML(rows)}
  `;
}

function renderDashboard() {
  const rows =
    dashboardFilteredRows();

  const coverage =
    teacherCoverage(
      rows,
      {
        departmentId:
          $("dashboardDeptFilter")
            ?.value ||
          "",

        teacherId:
          $("dashboardTeacherFilter")
            ?.value ||
          ""
      }
    );

  const consistency =
    consistencySummary(
      rows
    );

  const leadership =
    leadershipVisitStats(
      rows
    );

  const support =
    supportSummary();

  renderDashboardCriteriaAnalytics(
    rows
  );

  renderDashboardDepartmentPerformance(
    rows
  );

  renderDashboardQualityCard(
    rows
  );

  setKpi(
    "kpiVisits",
    rows.length,
    `العليا ${leadership.upper} • الوسطى ${leadership.middle}`
  );

  setKpi(
    "kpiCoverage",
    `${coverage.rate}%`,
    `${coverage.visited} من ${coverage.total}`
  );

  setKpi(
    "kpiDepartments",
    new Set(
      rows.map(
        visit =>
          visit.department_id
      )
    ).size
  );

  setKpi(
    "kpiConsistency",
    `${consistency.rate}%`
  );

  setKpi(
    "kpiSupport",
    support.open +
    support.follow
  );

  setKpi(
    "kpiTeachers",
    coverage.visited
  );

  const judgmentData =
    [
      4,
      3,
      2,
      1
    ]
      .map(
        rating =>
          rows.filter(
            visit =>
              num(
                visit.overall_rating
              ) ===
              rating
          ).length
      );

  makeChart(
    "judgmentChart",
    "doughnut",
    [
      "يتجاوز التوقعات بكثير",
      "يتجاوز التوقعات",
      "يفي بالتوقعات تمامًا",
      "يفي بالتوقعات جزئيًا"
    ],
    judgmentData,
    "الزيارات"
  );

  const domains =
    domainStats(
      rows
    );

  makeChart(
    "domainChart",
    "bar",
    domains.map(
      item =>
        item.domain
    ),
    domains.map(
      item =>
        item.meetsRate
    ),
    "يفي بالتوقعات تمامًا فأعلى %"
  );

  const skills =
    skillsStats(
      rows
    );

  makeChart(
    "skillsChart",
    "bar",
    skills.map(
      item =>
        item.label
    ),
    skills.map(
      item =>
        item.rate
    ),
    "نسبة الظهور %"
  );

  const work =
    studentWorkStats(
      rows
    );

  makeChart(
    "studentWorkChart",
    "bar",
    work.map(
      item =>
        item.label
    ),
    work.map(
      item =>
        item.rate
    ),
    "نسبة الظهور %"
  );

  makeChart(
    "coverageChart",
    "doughnut",
    [
      "تمت الزيارة",
      "لم تتم"
    ],
    [
      coverage.visited,
      coverage.remaining
    ],
    "المعلمات"
  );

  if (
    $("criteriaHeatmap")
  ) {
    $("criteriaHeatmap").innerHTML =
      criterionStats(
        rows
      )
        .map(
          item => {
            const modal =
              criterionMonthlyDistribution(
                rows,
                item.id
              );

            const dominantLevel =
              modal.modes?.length === 1
                ? modal.modes[0]
                : (
                    modal.modes?.length
                      ? Math.max(
                          ...modal.modes
                        )
                      : 0
                  );

            const dominantRate =
              modal.modeRate ||
              0;

            const rgb = {
              1: "190,70,70",
              2: "205,154,55",
              3: "72,145,112",
              4: "21,105,112"
            }[dominantLevel] ||
            "120,120,120";

            const alpha =
              0.18 +
              (
                dominantRate /
                100
              ) *
              0.62;

            return `
              <div
                class="heat-cell"
                style="
                  background:rgba(${rgb},${alpha.toFixed(2)});
                  border:1px solid rgba(${rgb},0.42);
                  border-radius:12px;
                  padding:12px;
                "
              >

                <strong>
                  م${item.id}
                </strong>

                <span>
                  ${
                    modal.total
                      ? `${esc(modalLevelText(modal))}`
                      : "لا توجد بيانات"
                  }
                </span>

              </div>
            `;
          }
        )
        .join("");
  }

  if (
    $("topGaps")
  ) {
    $("topGaps").innerHTML =
      listCards(
        weakestCriteria(
          rows
        ),
        item => `
          <div class="insight-row">

            <strong>
              م${item.id}
              —
              ${esc(
                item.criterion_text
              )}
            </strong>

            <span>
              ${item.inappropriateRate}% يفي بالتوقعات جزئيًا
            </span>

          </div>
        `
      );
  }

  if (
    $("topStrengths")
  ) {
    $("topStrengths").innerHTML =
      listCards(
        strongestCriteria(
          rows
        ),
        item => `
          <div class="insight-row">

            <strong>
              م${item.id}
              —
              ${esc(
                item.criterion_text
              )}
            </strong>

            <span>
              ${item.exceedsRate}% يتجاوز التوقعات
            </span>

          </div>
        `
      );
  }

  if (
    $("skillsWeakest")
  ) {
    $("skillsWeakest").innerHTML =
      listCards(
        [
          ...skills
        ]
          .sort(
            (
              a,
              b
            ) =>
              a.rate -
              b.rate
          )
          .slice(
            0,
            4
          ),
        item => `
          <div class="insight-row">

            <strong>
              ${esc(
                item.label
              )}
            </strong>

            <span>
              ${item.rate}%
            </span>

          </div>
        `
      );
  }

  if (
    $("studentWorkWeakest")
  ) {
    $("studentWorkWeakest").innerHTML =
      listCards(
        [
          ...work
        ]
          .sort(
            (
              a,
              b
            ) =>
              a.rate -
              b.rate
          )
          .slice(
            0,
            4
          ),
        item => `
          <div class="insight-row">

            <strong>
              ${esc(
                item.label
              )}
            </strong>

            <span>
              ${item.rate}%
            </span>

          </div>
        `
      );
  }

  if (
    $("evaluationKeysAnalysis")
  ) {
    $("evaluationKeysAnalysis").innerHTML =
      criterionStats(
        rows
      )
        .filter(
          item =>
            EVALUATION_KEYS.includes(
              item.id
            )
        )
        .map(
          item => `
            <div class="analysis-card">

              <strong>
                م${item.id}
              </strong>

              <span>
                ${item.meetsRate}% يفي بالتوقعات تمامًا فأعلى
              </span>

            </div>
          `
        )
        .join("");
  }

  if (
    $("unvisitedTeachers")
  ) {
    $("unvisitedTeachers").innerHTML =
      listCards(
        coverage.remainingTeachers,
        teacher => `
          <div class="person-item">
            ${esc(
              teacher.full_name
            )}
          </div>
        `
      );
  }

  if (
    $("supportSnapshot")
  ) {
    $("supportSnapshot").innerHTML =
      `
        <div>
          <strong>
            ${support.open}
          </strong>
          <span>
            مفتوح
          </span>
        </div>

        <div>
          <strong>
            ${support.follow}
          </strong>
          <span>
            تحت المتابعة
          </span>
        </div>

        <div>
          <strong>
            ${support.closed}
          </strong>
          <span>
            مغلق
          </span>
        </div>
      `;
  }

  if (
    $("supportImpactSummary")
  ) {
    const observed =
      supports
        .map(
          supportObservedRow
        )
        .filter(
          item =>
            item?.change
        );

    const improved =
      observed.filter(
        item =>
          item.change.label ===
          "تحسن"
      ).length;

    const stable =
      observed.filter(
        item =>
          item.change.label ===
          "استقرار"
      ).length;

    const declined =
      observed.filter(
        item =>
          item.change.label ===
          "تراجع"
      ).length;

    $("supportImpactSummary").innerHTML =
      `
        <div class="support-stats">

          <div>
            <strong>
              ${improved}
            </strong>
            <span>
              تحسن
            </span>
          </div>

          <div>
            <strong>
              ${stable}
            </strong>
            <span>
              استقرار
            </span>
          </div>

          <div>
            <strong>
              ${declined}
            </strong>
            <span>
              تراجع
            </span>
          </div>

        </div>
      `;
  }

  if (
    $("recentVisits")
  ) {
    const map =
      maps();

    $("recentVisits").innerHTML =
      listCards(
        rows.slice(
          0,
          6
        ),
        visit => `
          <div class="insight-row">

            <strong>
              ${esc(
                map.teachers[
                  String(
                    visit.teacher_id
                  )
                ]?.full_name ||
                "—"
              )}
            </strong>

            <span>
              ${formatDate(
                visit.visit_date
              )}
              •
              ${esc(
                evaluatorName(
                  visit
                )
              )}
            </span>

          </div>
        `
      );
  }

  if (
    $("leadershipInsights")
  ) {
    $("leadershipInsights").innerHTML =
      `
        <div class="insight-row">

          <strong>
            زيارات القيادة العليا
          </strong>

          <span>
            ${leadership.upper}
          </span>

        </div>

        <div class="insight-row">

          <strong>
            زيارات القيادة الوسطى
          </strong>

          <span>
            ${leadership.middle}
          </span>

        </div>

        <div class="insight-row">

          <strong>
            زيارات لا تنطبق قياديًا
          </strong>

          <span>
            ${leadership.other}
          </span>

        </div>
      `;
  }

  if (
    $("leadershipDecisionTitle")
  ) {
    const gaps =
      weakestCriteria(
        rows
      );

    $("leadershipDecisionTitle").textContent =
      gaps[0]
        ? `أولوية المتابعة: المعيار ${gaps[0].id}`
        : "استكمال التغطية أولًا";

    $("leadershipDecisionText").textContent =
      gaps[0]
        ? gaps[0].criterion_text
        : `تمت زيارة ${coverage.visited} من ${coverage.total} معلمة.`;

    $("leadershipDecisionBadge").textContent =
      gaps[0] &&
      gaps[0].inappropriateRate >=
        40
        ? "أولوية مرتفعة"
        : "متابعة";
  }
}

/* =========================================================
   HISTORY
========================================================= */

function filteredHistory() {
  return visits.filter(
    visit =>
      (
        !$("histMonth")
          ?.value ||
        monthKey(
          visit.visit_date
        ) ===
        $("histMonth")
          .value
      ) &&
      (
        !$("histTeacher")
          ?.value ||
        String(
          visit.teacher_id
        ) ===
        $("histTeacher")
          .value
      ) &&
      (
        !$("histDept")
          ?.value ||
        String(
          visit.department_id
        ) ===
        $("histDept")
          .value
      ) &&
      (
        !$("histSubject")?.value ||
        v6Norm(v6SubjectNameById(visit.subject_id)) ===
          v6Norm(v6SubjectNameById($("histSubject").value))
      ) &&
      (
        !$("histRating")
          ?.value ||
        String(
          visit.overall_rating
        ) ===
        $("histRating")
          .value
      )
  );
}

function renderHistory() {
  const box =
    $("historyTable");

  if (!box) {
    return;
  }

  const rows =
    filteredHistory();

  const map =
    maps();

  if (
    $("historyCount")
  ) {
    $("historyCount").textContent =
      `${rows.length} زيارة`;
  }

  box.innerHTML =
    `
      <div class="table-wrap">

        <table>

          <thead>

            <tr>
              <th>التاريخ</th>
              <th>المعلمة</th>
              <th>القسم</th>
              <th>المادة</th>
              <th>الحكم</th>
              <th>المقيم</th>
              <th>المستوى</th>
              <th>إجراءات</th>
            </tr>

          </thead>

          <tbody>

            ${
              rows
                .map(
                  visit => `
                    <tr>

                      <td>
                        ${formatDate(
                          visit.visit_date
                        )}
                      </td>

                      <td>
                        ${esc(
                          map.teachers[
                            String(
                              visit.teacher_id
                            )
                          ]?.full_name ||
                          "—"
                        )}
                      </td>

                      <td>
                        ${esc(
                          map.departments[
                            String(
                              visit.department_id
                            )
                          ]?.name ||
                          "—"
                        )}
                      </td>

                      <td>
                        ${esc(
                          v6VisitSubject(visit) ||
                          "—"
                        )}
                      </td>

                      <td>
                        ${ratingShort(
                          visit.overall_rating
                        )}
                      </td>

                      <td>
                        ${esc(
                          evaluatorName(
                            visit
                          )
                        )}
                      </td>

                      <td>
                        ${esc(
                          evaluatorLevel(
                            visit
                          )
                        )}
                      </td>

                      <td>

                        <button
                          onclick="viewVisit('${visit.id}')"
                        >
                          عرض
                        </button>

                        <button
                          onclick="editVisit('${visit.id}')"
                        >
                          تعديل
                        </button>

                        <button
                          onclick="printVisitForm('${visit.id}')"
                        >
                          طباعة الاستمارة
                        </button>

                        <button
                          onclick="deleteVisit('${visit.id}')"
                        >
                          حذف
                        </button>

                      </td>

                    </tr>
                  `
                )
                .join("")
            }

          </tbody>

        </table>

      </div>
    `;
}

/* =========================================================
   MONTHLY + OVERALL
========================================================= */

function analysisHTML(
  rows,
  title,
  growthRows = rows,
  scope = {}
) {
  const coverage =
    teacherCoverage(
      rows,
      scope
    );

  const consistency =
    consistencySummary(
      rows
    );

  const leadership =
    leadershipVisitStats(
      rows
    );

  const gaps =
    weakestCriteria(
      rows
    );

  const strengths =
    strongestCriteria(
      rows
    );

  const scopeText =
    scopeLabel(
      scope.departmentId ||
        "",
      scope.teacherId ||
        ""
    );

  return `
    <article class="panel">

      <h3>
        ${esc(
          title
        )}
      </h3>

      <p class="scope-note">
        نطاق التحليل:
        <strong>
          ${esc(
            scopeText
          )}
        </strong>
      </p>

      <div class="executive-kpi-grid">

        <article class="executive-kpi">
          <span>
            إجمالي الزيارات
          </span>
          <strong>
            ${rows.length}
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            القيادة العليا
          </span>
          <strong>
            ${leadership.upper}
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            القيادة الوسطى
          </span>
          <strong>
            ${leadership.middle}
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            المقيمون المشاركون
          </span>
          <strong>
            ${leadership.evaluators}
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            التغطية
          </span>
          <strong>
            ${coverage.rate}%
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            الاتساق
          </span>
          <strong>
            ${consistency.rate}%
          </strong>
        </article>

      </div>

      ${
        coverage.basis ===
        "department-observed"
          ? `
              <div class="analysis-note">
                تُحتسب تغطية القسم من المعلمات اللاتي ظهرت لهن زيارة مسجلة في هذا القسم خلال العام الدراسي؛ لأن سجل المعلمات الأساسي لا يتضمن قسمًا ثابتًا للمعلمة.
              </div>
            `
          : ""
      }

      <div class="dashboard-grid two">

        <div>

          <h4>
            مقارنة الزيارات القيادية
          </h4>

          <div class="analysis-card">

            <strong>
              قيادة عليا:
              ${leadership.upper}
            </strong>

          </div>

          <div class="analysis-card">

            <strong>
              قيادة وسطى:
              ${leadership.middle}
            </strong>

          </div>

        </div>

        <div>

          <h4>
            المقيمون
          </h4>

          ${
            listCards(
              leadership.evaluatorDetails,
              item => `
                <div class="insight-row">

                  <strong>
                    ${esc(
                      item.name
                    )}
                  </strong>

                  <span>
                    ${esc(
                      item.level
                    )}
                    •
                    ${item.count}
                    زيارة
                  </span>

                </div>
              `
            )
          }

        </div>

      </div>

      <div class="dashboard-grid two">

        <div>

          <h4>
            أولويات المتابعة
          </h4>

          ${
            listCards(
              gaps,
              item => `
                <div class="insight-row">

                  <strong>
                    م${item.id}
                    —
                    ${esc(
                      item.criterion_text
                    )}
                  </strong>

                  <span>
                    ${item.inappropriateRate}%
                    يفي بالتوقعات جزئيًا
                  </span>

                </div>
              `
            )
          }

        </div>

        <div>

          <h4>
            جوانب القوة
          </h4>

          ${
            listCards(
              strengths,
              item => `
                <div class="insight-row">

                  <strong>
                    م${item.id}
                    —
                    ${esc(
                      item.criterion_text
                    )}
                  </strong>

                  <span>
                    ${item.exceedsRate}%
                    يتجاوز التوقعات فأعلى
                  </span>

                </div>
              `
            )
          }

        </div>

      </div>

      <div class="criteria-intelligence">

        ${criteriaIntelligenceHTML(
          rows,
          growthRows,
          scopeText
        )}

      </div>

    </article>
  `;
}

function renderMonthly() {
  const month =
    $("monthlyMonth")
      ?.value ||
    availableMonths()[0] ||
    "";

  const rows =
    monthlyScopeRows(
      month
    );

  const growthRows =
    monthlyGrowthRows(
      month
    );

  const label =
    scopeLabel(
      $("monthlyDeptFilter")
        ?.value ||
      "",
      $("monthlyTeacherFilter")
        ?.value ||
      ""
    );

  if (
    $("monthlyContent")
  ) {
    $("monthlyContent").innerHTML =
      analysisHTML(
        rows,
        month
          ? `التحليل الشهري — ${monthLabel(month)} — ${label}`
          : `التحليل الشهري — ${label}`,
        growthRows,
        {
          departmentId:
            $("monthlyDeptFilter")
              ?.value ||
            "",

          teacherId:
            $("monthlyTeacherFilter")
              ?.value ||
            ""
        }
      );
  }
}

function renderOverall() {
  const rows =
    overallFilteredRows();

  const label =
    scopeLabel(
      $("overallDeptFilter")
        ?.value ||
      "",
      $("overallTeacherFilter")
        ?.value ||
      ""
    );

  if (
    $("overallContent")
  ) {
    $("overallContent").innerHTML =
      analysisHTML(
        rows,
        `التحليل الشامل — ${APP_CONFIG.academicYear} — ${label}`,
        rows,
        {
          departmentId:
            $("overallDeptFilter")
              ?.value ||
            "",

          teacherId:
            $("overallTeacherFilter")
              ?.value ||
            ""
        }
      ) + `
        <article class="panel strategic-panel" style="margin-top:20px;">
          <div class="panel-head">
            <div>
              <span class="panel-kicker">DEPARTMENT PERFORMANCE READINGS</span>
              <h3>قراءة مستويات الأداء حسب الأقسام</h3>
              <p>قراءة تجميعية للمعلمات المرصودات وفق مسار الأداء في الزيارات المسجلة.</p>
            </div>
          </div>
          ${departmentPerformanceReadingsHTML(rows)}
        </article>
      `;
  }
}

/* =========================================================
   SUPPORT VIEW
========================================================= */

function renderSupport() {
  const box =
    $("supportContent");

  if (!box) {
    return;
  }

  const teacherFilter =
    $("supportTeacherFilter")
      ?.value ||
    "";

  const statusFilter =
    $("supportStatusFilter")
      ?.value ||
    "";

  const map =
    maps();

  const rows =
    supports.filter(
      support =>
        (
          !teacherFilter ||
          String(
            support.teacher_id
          ) ===
          teacherFilter
        ) &&
        (
          !statusFilter ||
          support.status ===
          statusFilter
        )
    );

  box.innerHTML =
    rows.length
      ? rows
          .map(
            support => {
              const observed =
                supportObservedRow(
                  support
                );

              const criterion =
                criteria.find(
                  item =>
                    num(
                      item.id
                    ) ===
                    num(
                      support.criterion_no
                    )
                );

              return `
                <article
                  class="panel support-card"
                >

                  <div class="panel-head">

                    <div>

                      <h3>
                        ${esc(
                          map.teachers[
                            String(
                              support.teacher_id
                            )
                          ]?.full_name ||
                          "—"
                        )}
                      </h3>

                      <p>
                        م${support.criterion_no}
                        —
                        ${esc(
                          criterion?.criterion_text ||
                          ""
                        )}
                      </p>

                    </div>

                    <span>
                      ${esc(
                        support.status ||
                        "مفتوح"
                      )}
                    </span>

                  </div>


                  <div class="form-grid three">

                    <div>
                      <strong>
                        أسلوب الدعم
                      </strong>
                      <br>
                      ${esc(
                        support.support_type ||
                        "—"
                      )}
                    </div>

                    <div>
                      <strong>
                        تاريخ الدعم
                      </strong>
                      <br>
                      ${formatDate(
                        support.support_date
                      )}
                    </div>

                    <div>
                      <strong>
                        التفاصيل
                      </strong>
                      <br>
                      ${esc(
                        support.support_details ||
                        "—"
                      )}
                    </div>

                  </div>


                  ${
                    observed
                      ? `
                          <div
                            class="analysis-card"
                            style="margin-top:14px"
                          >

                            <strong>
                              المقارنة المرصودة
                            </strong>

                            ${
                              observed.follow &&
                              observed.before &&
                              observed.after

                                ? `
                                    <div class="form-grid three">

                                      <div>

                                        الرصد السابق
                                        <br>

                                        <strong>
                                          ${ratingShort(
                                            observed.before
                                          )}
                                        </strong>

                                        <br>

                                        <small>
                                          ${formatDate(
                                            observed.source.visit_date
                                          )}
                                        </small>

                                      </div>


                                      <div>

                                        الرصد اللاحق
                                        <br>

                                        <strong>
                                          ${ratingShort(
                                            observed.after
                                          )}
                                        </strong>

                                        <br>

                                        <small>
                                          ${formatDate(
                                            observed.follow.visit_date
                                          )}
                                        </small>

                                      </div>


                                      <div>

                                        النتيجة
                                        <br>

                                        <strong>
                                          ${observed.change.label}
                                        </strong>

                                      </div>

                                    </div>
                                  `

                                : `
                                    <p>
                                      لم تُسجل بعد زيارة لاحقة تسمح بالمقارنة على هذا المعيار.
                                    </p>
                                  `
                            }

                          </div>
                        `
                      : ""
                  }

                </article>
              `;
            }
          )
          .join("")

      : `
          <div class="empty-state">
            لا توجد إجراءات دعم مطابقة.
          </div>
        `;
}

/* =========================================================
   REPORTS
========================================================= */

function selectedReportMode() {
  return (
    document.querySelector(
      'input[name="mainReportMode"]:checked'
    )?.value ||
    "monthly"
  );
}

function reportRows() {
  const mode =
    selectedReportMode();

  const departmentId =
    $("reportDeptFilter")
      ?.value ||
    "";

  const teacherId =
    $("reportTeacherFilter")
      ?.value ||
    "";

  if (
    mode ===
    "overall"
  ) {
    return filterVisitsByScope(
      visits,
      {
        departmentId,
        teacherId,
        fromMonth:
          $("reportFromMonth")
            ?.value ||
          "",
        toMonth:
          $("reportToMonth")
            ?.value ||
          ""
      }
    );
  }

  const month =
    $("reportMonth")
      ?.value ||
    availableMonths()[0] ||
    "";

  return filterVisitsByScope(
    visits,
    {
      departmentId,
      teacherId,
      fromMonth:
        month,
      toMonth:
        month
    }
  );
}

function reportGrowthRows() {
  const departmentId =
    $("reportDeptFilter")
      ?.value ||
    "";

  const teacherId =
    $("reportTeacherFilter")
      ?.value ||
    "";

  const mode =
    selectedReportMode();

  if (
    mode ===
    "monthly"
  ) {
    const selectedMonth =
      $("reportMonth")
        ?.value ||
      availableMonths()[0] ||
      "";

    const scoped =
      filterVisitsByScope(
        visits,
        {
          departmentId,
          teacherId
        }
      );

    const months =
      [
        ...new Set(
          scoped
            .map(
              visit =>
                monthKey(
                  visit.visit_date
                )
            )
            .filter(
              Boolean
            )
        )
      ].sort();

    const index =
      months.indexOf(
        selectedMonth
      );

    const wanted =
      index > 0
        ? [
            months[index - 1],
            selectedMonth
          ]
        : [
            selectedMonth
          ];

    return scoped.filter(
      visit =>
        wanted.includes(
          monthKey(
            visit.visit_date
          )
        )
    );
  }

  return filterVisitsByScope(
    visits,
    {
      departmentId,
      teacherId,

      fromMonth:
        $("reportFromMonth")
          ?.value ||
        "",

      toMonth:
        $("reportToMonth")
          ?.value ||
        ""
    }
  );
}

function generateReport() {
  const box =
    $("reportOutput");

  if (!box) {
    return;
  }

  const rows =
    reportRows();

  const growthRows =
    reportGrowthRows();

  const mode =
    selectedReportMode();

  const departmentId =
    $("reportDeptFilter")
      ?.value ||
    "";

  const teacherId =
    $("reportTeacherFilter")
      ?.value ||
    "";

  const reportScope =
    scopeLabel(
      departmentId,
      teacherId
    );

  const period =
    mode ===
      "overall"
      ? APP_CONFIG.academicYear
      : monthLabel(
          $("reportMonth")
            ?.value ||
          availableMonths()[0] ||
          ""
        );

  const leadership =
    leadershipVisitStats(
      rows
    );

  const coverage =
    teacherCoverage(
      rows,
      {
        departmentId,
        teacherId
      }
    );

  const gaps =
    weakestCriteria(
      rows
    );

  box.innerHTML =
    `
      <div class="official-report">

        <img
          src="${SCHOOL_HEADER_IMAGE}"
          style="
            max-width:100%;
            margin-bottom:18px;
          "
          alt="الترويسة الرسمية"
        >

        <h2>
          تقرير الزيارات الصفية
        </h2>

        <p>
          ${esc(
            period
          )}
          —
          ${esc(
            reportScope
          )}
        </p>

        <h3>
          الملخص التنفيذي
        </h3>

        <p id="officialExecutiveSummary">
          بلغ إجمالي الزيارات
          <strong>
            ${rows.length}
          </strong>
          زيارة،
          منها
          <strong>
            ${leadership.upper}
          </strong>
          للقيادة العليا
          و
          <strong>
            ${leadership.middle}
          </strong>
          للقيادة الوسطى.
          وبلغت التغطية الرصدية
          <strong>
            ${coverage.rate}%
          </strong>.
        </p>

        <h3>
          أبرز الأولويات
        </h3>

        ${
          gaps.length
            ? `
                <ul>

                  ${
                    gaps
                      .map(
                        item => `
                          <li>
                            المعيار
                            م${item.id}:
                            ${esc(
                              item.criterion_text
                            )}
                            —
                            يفي بالتوقعات جزئيًا
                            ${item.inappropriateRate}%
                          </li>
                        `
                      )
                      .join("")
                  }

                </ul>
              `
            : `
                <p>
                  لا توجد بيانات كافية لتحديد أولوية.
                </p>
              `
        }

        <h3>
          قراءة مستويات الأداء حسب الأقسام
        </h3>

        ${departmentPerformanceReadingsHTML(rows, { compact: true })}

        <h3>
          تحليل المعايير والنمو
        </h3>

        ${criteriaIntelligenceHTML(
          rows,
          growthRows,
          reportScope
        )}

        <h3>
          التوصيات
        </h3>

        <p id="officialRecommendations">
          توجيه الدعم المهني نحو المعايير الأكثر تكرارًا في الحاجة إلى التطوير،
          ومتابعة التغير المرصود في الزيارات اللاحقة،
          مع مراعاة حجم العينة وعدم تعميم النتائج خارج نطاق البيانات المتاحة.
        </p>

        <div
          class="report-signatures"
          style="
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:20px;
            margin-top:34px;
            padding-top:18px;
            border-top:2px solid #0d5f66;
            text-align:center;
          "
        >

          <div>
            <span>
              معدّة التقرير
            </span>
            <br>
            <strong>
              ${REPORT_INFO.preparedBy}
            </strong>
          </div>

          <div>
            <span>
              المديرة المساعدة
            </span>
            <br>
            <strong>
              ${REPORT_INFO.assistantPrincipal}
            </strong>
          </div>

          <div>
            <span>
              مديرة المدرسة
            </span>
            <br>
            <strong>
              ${REPORT_INFO.principal}
            </strong>
          </div>

        </div>

      </div>
    `;
}

function localReportNarrative(rows) {
  const departmentId = $("reportDeptFilter")?.value || "";
  const teacherId = $("reportTeacherFilter")?.value || "";
  const scope = scopeLabel(departmentId, teacherId);
  const leadership = leadershipVisitStats(rows);
  const coverage = teacherCoverage(rows, { departmentId, teacherId });
  const gaps = weakestCriteria(rows).slice(0, 3);
  const strengths = strongestCriteria(rows).slice(0, 3);

  const summaryParts = [
    `يعرض التقرير نتائج ${rows.length} زيارة صفية ضمن نطاق ${scope}.`,
    `بلغت التغطية الرصدية ${coverage.rate}%، مع ${leadership.upper} زيارة للقيادة العليا و${leadership.middle} زيارة للقيادة الوسطى.`
  ];

  if (strengths.length) {
    summaryParts.push(
      `وتشير البيانات المرصودة إلى قوة نسبية في ${strengths.map(item => `المعيار م${item.id} (${item.criterion_text})`).join("، ")}.`
    );
  }

  if (gaps.length) {
    summaryParts.push(
      `وتتركز أولويات المتابعة في ${gaps.map(item => `المعيار م${item.id} (${item.criterion_text})`).join("، ")}.`
    );
  } else {
    summaryParts.push("ولا تتوافر حاليًا بيانات كافية لتحديد أولويات تفصيلية على مستوى المعايير.");
  }

  const recommendations = gaps.length
    ? `يوصى بتوجيه المتابعة المهنية نحو ${gaps.map(item => `م${item.id}`).join("، ")}، ومراجعة التغير المرصود في الزيارات اللاحقة، مع ربط الدعم باحتياجات القسم أو المعلمة وفق نطاق التقرير، ومراعاة حجم العينة قبل تعميم النتائج.`
    : "يوصى باستمرار الرصد المنتظم واستكمال حجم العينة، ثم تحديد أولويات الدعم المهني في ضوء النتائج المتراكمة للزيارات اللاحقة.";

  return {
    summary: summaryParts.join(" "),
    recommendations
  };
}

function ensureNarrativeEditor() {
  let editor = $("reportNarrativeEditor");
  if (editor) return editor;

  const output = $("reportOutput");
  if (!output) return null;

  editor = document.createElement("section");
  editor.id = "reportNarrativeEditor";
  editor.className = "panel";
  editor.style.marginBottom = "18px";
  editor.innerHTML = `
    <h3>تحرير صياغة التقرير</h3>
    <p class="muted">يمكنك تعديل النص أو الإضافة عليه قبل اعتماده في التقرير والطباعة.</p>
    <label style="display:block;margin:14px 0 6px;font-weight:700;">الملخص التنفيذي</label>
    <textarea id="narrativeSummaryEditor" rows="7" style="width:100%;min-height:150px;resize:vertical;"></textarea>
    <label style="display:block;margin:14px 0 6px;font-weight:700;">التوصيات</label>
    <textarea id="narrativeRecommendationsEditor" rows="6" style="width:100%;min-height:130px;resize:vertical;"></textarea>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
      <button type="button" class="btn btn-primary" id="applyNarrativeEdits">اعتماد التعديلات في التقرير</button>
      <button type="button" class="btn btn-soft" id="restoreNarrativeDraft">استعادة آخر صياغة</button>
    </div>
    <div id="narrativeEditorStatus" class="muted" style="margin-top:8px;"></div>
  `;
  output.parentNode.insertBefore(editor, output);

  $("applyNarrativeEdits")?.addEventListener("click", applyNarrativeEdits);
  $("restoreNarrativeDraft")?.addEventListener("click", () => {
    if ($("narrativeSummaryEditor")) $("narrativeSummaryEditor").value = reportNarrativeDraft.summary || "";
    if ($("narrativeRecommendationsEditor")) $("narrativeRecommendationsEditor").value = reportNarrativeDraft.recommendations || "";
  });

  return editor;
}

function applyNarrativeEdits() {
  const summary = $("narrativeSummaryEditor")?.value?.trim() || "";
  const recommendations = $("narrativeRecommendationsEditor")?.value?.trim() || "";

  reportNarrativeDraft = { summary, recommendations };

  const summaryTarget = $("officialExecutiveSummary");
  const recommendationsTarget = $("officialRecommendations");

  if (!summaryTarget || !recommendationsTarget) {
    generateReport();
  }

  const freshSummaryTarget = $("officialExecutiveSummary");
  const freshRecommendationsTarget = $("officialRecommendations");
  if (freshSummaryTarget) freshSummaryTarget.textContent = summary;
  if (freshRecommendationsTarget) freshRecommendationsTarget.textContent = recommendations;

  const editorStatus = $("narrativeEditorStatus");
  if (editorStatus) editorStatus.textContent = "تم اعتماد النص المعدل داخل التقرير، وستظهر هذه النسخة في الطباعة / PDF.";
}

async function generateNarrative() {
  const status = $("narrativeStatus");
  const rows = reportRows();

  if (!$("reportOutput")?.innerHTML.trim()) {
    generateReport();
  }

  ensureNarrativeEditor();

  try {
    if (status) status.textContent = "جاري إعداد الصياغة...";

    const { data, error } = await sb.functions.invoke(
      "generate-report-narrative",
      {
        body: {
          academicYear: APP_CONFIG.academicYear,
          visitsCount: rows.length,
          gaps: weakestCriteria(rows).map(item => ({
            criterion: item.id,
            text: item.criterion_text,
            rate: item.inappropriateRate
          }))
        }
      }
    );

    if (error) throw error;

    const fallback = localReportNarrative(rows);
    reportNarrativeDraft = {
      summary: String(data?.summary || fallback.summary).trim(),
      recommendations: String(data?.recommendations || fallback.recommendations).trim()
    };

    if ($("narrativeSummaryEditor")) $("narrativeSummaryEditor").value = reportNarrativeDraft.summary;
    if ($("narrativeRecommendationsEditor")) $("narrativeRecommendationsEditor").value = reportNarrativeDraft.recommendations;
    applyNarrativeEdits();

    if (status) status.textContent = "تم إعداد الصياغة. يمكنك تعديلها ثم اعتماد التعديلات.";
  } catch (error) {
    console.error(error);

    reportNarrativeDraft = localReportNarrative(rows);
    if ($("narrativeSummaryEditor")) $("narrativeSummaryEditor").value = reportNarrativeDraft.summary;
    if ($("narrativeRecommendationsEditor")) $("narrativeRecommendationsEditor").value = reportNarrativeDraft.recommendations;
    applyNarrativeEdits();

    if (status) status.textContent = "تم إعداد صياغة محلية من بيانات التقرير. يمكنك تعديلها واعتمادها.";
  }
}

/* =========================================================
   VISIT DRAFT AUTO-SAVE
========================================================= */

const VISIT_DRAFT_KEY =
  "classroomVisits:draft:" +
  String(
    APP_CONFIG.academicYear ||
    "current"
  );

let draftTimer = null;
let restoringDraft = false;

function updateVisitDraftStatus(
  text,
  state = "saved"
) {
  const element =
    $("visitDraftStatus");

  if (!element) {
    return;
  }

  element.className =
    `visit-draft-status ${state}`;

  element.textContent =
    text;
}

function collectVisitDraft() {
  const form =
    $("visitForm");

  if (!form) {
    return null;
  }

  const fields = {};

  form
    .querySelectorAll(
      "input, select, textarea"
    )
    .forEach(
      element => {
        if (
          !element.id &&
          !element.name
        ) {
          return;
        }

        const key =
          element.id ||
          element.name;

        if (
          element.type ===
            "radio"
        ) {
          if (
            element.checked
          ) {
            fields[
              element.name
            ] =
              element.value;
          }
        }
        else if (
          element.type ===
            "checkbox"
        ) {
          fields[key] =
            !!element.checked;
        }
        else {
          fields[key] =
            element.value;
        }
      }
    );

  return {
    version: 1,
    savedAt:
      new Date()
        .toISOString(),
    editingVisitId:
      editingVisitId ||
      null,
    fields
  };
}

function saveVisitDraft() {
  if (
    restoringDraft
  ) {
    return;
  }

  const draft =
    collectVisitDraft();

  if (!draft) {
    return;
  }

  try {
    localStorage.setItem(
      VISIT_DRAFT_KEY,
      JSON.stringify(
        draft
      )
    );

    updateVisitDraftStatus(
      "✓ تم حفظ المسودة تلقائيًا",
      "saved"
    );
  }
  catch (
    error
  ) {
    console.warn(
      "تعذر حفظ مسودة الزيارة محليًا:",
      error
    );
  }
}

function scheduleVisitDraftSave() {
  clearTimeout(
    draftTimer
  );

  updateVisitDraftStatus(
    "جاري حفظ المسودة…",
    "saving"
  );

  draftTimer =
    setTimeout(
      saveVisitDraft,
      350
    );
}

function clearVisitDraft() {
  clearTimeout(
    draftTimer
  );

  try {
    localStorage.removeItem(
      VISIT_DRAFT_KEY
    );

    updateVisitDraftStatus(
      "● يتم حفظ المسودة تلقائيًا",
      "idle"
    );
  }
  catch (
    error
  ) {
    console.warn(
      error
    );
  }
}

function hasMeaningfulDraft(
  draft
) {
  if (
    !draft?.fields
  ) {
    return false;
  }

  return Object.entries(
    draft.fields
  )
    .some(
      (
        [
          key,
          value
        ]
      ) => {
        if (
          key ===
            "visitDate"
        ) {
          return false;
        }

        return (
          value ===
            true ||
          (
            typeof value ===
              "string" &&
            value.trim() !==
              ""
          )
        );
      }
    );
}

function restoreVisitDraft(
  draft
) {
  if (
    !draft?.fields
  ) {
    return;
  }

  restoringDraft =
    true;

  editingVisitId =
    draft.editingVisitId ||
    null;

  const form =
    $("visitForm");

  Object.entries(
    draft.fields
  )
    .forEach(
      (
        [
          key,
          value
        ]
      ) => {
        const byId =
          $(key);

        if (
          byId
        ) {
          if (
            byId.type ===
              "checkbox"
          ) {
            byId.checked =
              !!value;
          }
          else {
            byId.value =
              value ?? "";
          }

          return;
        }

        const radio =
          form?.querySelector(
            `input[type="radio"][name="${CSS.escape(
              key
            )}"][value="${CSS.escape(
              String(
                value
              )
            )}"]`
          );

        if (
          radio
        ) {
          radio.checked =
            true;
        }
      }
    );

  updateSubjectSelect(
    draft.fields
      .subjectSelect ||
    ""
  );

  if (
    $("subjectSelect") &&
    draft.fields
      .subjectSelect
  ) {
    $("subjectSelect").value =
      String(
        draft.fields
          .subjectSelect
      );
  }

  updateEvaluatorBlock();
  updateConsistencyHint();

  restoringDraft =
    false;

  showView(
    "newVisit"
  );

  const message =
    $("saveMsg");

  if (
    message
  ) {
    message.className =
      "message success";

    message.textContent =
      "تمت استعادة المسودة غير المحفوظة تلقائيًا.";
  }

  updateVisitDraftStatus(
    "✓ تمت استعادة المسودة — وسيستمر الحفظ التلقائي",
    "saved"
  );
}

function offerVisitDraftRestore() {
  let draft = null;

  try {
    draft =
      JSON.parse(
        localStorage.getItem(
          VISIT_DRAFT_KEY
        ) ||
        "null"
      );
  }
  catch (
    error
  ) {
    clearVisitDraft();
    return;
  }

  if (
    !hasMeaningfulDraft(
      draft
    )
  ) {
    return;
  }

  const savedAt =
    draft.savedAt
      ? new Date(
          draft.savedAt
        )
          .toLocaleString(
            "ar-BH"
          )
      : "";

  const restore =
    confirm(
      "توجد مسودة زيارة لم يتم حفظها" +
      (
        savedAt
          ? ` (${savedAt})`
          : ""
      ) +
      ".\n\nهل تريدين استعادتها الآن؟"
    );

  if (
    restore
  ) {
    restoreVisitDraft(
      draft
    );
  }
  else {
    clearVisitDraft();
  }
}

function bindVisitDraftAutosave() {
  const form =
    $("visitForm");

  if (!form) {
    return;
  }

  updateVisitDraftStatus(
    "● يتم حفظ المسودة تلقائيًا",
    "idle"
  );

  [
    "input",
    "change"
  ]
    .forEach(
      eventName =>
        form.addEventListener(
          eventName,
          scheduleVisitDraftSave
        )
    );

  window.addEventListener(
    "beforeunload",
    () => {
      saveVisitDraft();
    }
  );
}

/* =========================================================
   FORM HELPERS
========================================================= */

function clearForm() {
  editingVisitId =
    null;

  $("visitForm")
    ?.reset();

  document
    .querySelectorAll(
      'input[name^="criterion_"]'
    )
    .forEach(
      item =>
        item.checked =
          false
    );

  document
    .querySelectorAll(
      ".support-criterion-check"
    )
    .forEach(
      item =>
        item.checked =
          false
    );

  criteria.forEach(
    criterion => {
      const note =
        $(
          `criterionNote_${criterion.id}`
        );

      if (
        note
      ) {
        note.value =
          "";
      }
    }
  );

  if (
    $("visitDate")
  ) {
    $("visitDate").value =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );
  }

  if (
    currentProfile?.role ===
      "admin" &&
    $("visitObserverSelect")
  ) {
    $("visitObserverSelect").value =
      "";
  }

  updateSubjectSelect();

  updateEvaluatorBlock();

  updateConsistencyHint();
}

async function upsertSingle(
  table,
  visitId,
  payload
) {
  const {
    error
  } =
    await sb
      .from(
        table
      )
      .upsert(
        {
          visit_id:
            visitId,

          ...payload
        },
        {
          onConflict:
            "visit_id"
        }
      );

  if (
    error
  ) {
    throw error;
  }
}

/* =========================================================
   SAVE VISIT
========================================================= */

async function saveVisit(
  event
) {
  event.preventDefault();

  const message =
    $("saveMsg");

  try {
    const ratingsMap =
      collectCriterionRatings();

    const missing =
      criteria.filter(
        criterion =>
          !ratingsMap[
            num(
              criterion.id
            )
          ]
      );

    if (
      missing.length
    ) {
      throw new Error(
        "استكملي تقييم المعايير الثمانية عشر."
      );
    }

    const base =
      Math.min(
        num(
          ratingsMap[1]
        ),
        num(
          ratingsMap[2]
        )
      );

    if (
      num(
        ratingsMap[9]
      ) >
        base ||
      num(
        ratingsMap[10]
      ) >
        base
    ) {
      throw new Error(
        "المعياران م9 وم10 لا يجوز أن يكونا أعلى من الأقل بين م1 وم2، ويجوز أن يساوياه أو يكونا أقل منه."
      );
    }

    const observer =
      selectedObserverProfile();

    if (
      currentProfile?.role ===
        "admin" &&
      !$("visitObserverSelect")
        ?.value
    ) {
      throw new Error(
        "اختاري منفذ الزيارة الفعلي."
      );
    }

    const payload = {
      visit_date:
        $("visitDate").value,

      academic_year:
        APP_CONFIG.academicYear,

      teacher_id:
        num(
          $("teacherSelect")
            .value
        ),

      department_id:
        num(
          $("departmentSelect")
            .value
        ),

      subject_id:
        num(
          $("subjectSelect")
            .value
        ),

      observer_id:
        observer.id,

      visit_number:
        $("visitNumber")
          .value
          ? num(
              $("visitNumber")
                .value
            )
          : null,

      grade_section:
        $("gradeSection")
          .value ||
        null,

      period_name:
        $("periodName")
          .value ||
        null,

      lesson_title:
        $("lessonTitle")
          .value ||
        null,

      students_count:
        $("studentsCount")
          .value
          ? num(
              $("studentsCount")
                .value
            )
          : null,

      absent_count:
        $("absentCount")
          .value
          ? num(
              $("absentCount")
                .value
            )
          : null,

      overall_rating:
        num(
          $("overallRating")
            .value
        ),

      general_notes:
        $("generalNotes")
          .value ||
        null
    };

    if (
      !payload.teacher_id ||
      !payload.department_id ||
      !payload.subject_id ||
      !payload.visit_date ||
      !payload.overall_rating
    ) {
      throw new Error(
        "استكملي بيانات الزيارة الأساسية."
      );
    }

    const consistency =
      consistencyForRatings(
        ratingsMap,
        payload.overall_rating
      );

    if (
      !consistency.consistent
    ) {
      throw new Error(
        consistency.messages.join(
          "\n"
        )
      );
    }

    const supportType =
      $("supportType")
        ?.value ||
      "";

    const selectedCriteria =
      selectedSupportCriteria();

    if (
      supportType &&
      !selectedCriteria.length
    ) {
      throw new Error(
        "اختاري معيارًا واحدًا على الأقل للدعم."
      );
    }

    let visitId =
      editingVisitId;

    if (
      editingVisitId
    ) {
      const {
        error
      } =
        await sb
          .from(
            "visits"
          )
          .update(
            payload
          )
          .eq(
            "id",
            editingVisitId
          );

      if (
        error
      ) {
        throw error;
      }
    }
    else {
      const {
        data,
        error
      } =
        await sb
          .from(
            "visits"
          )
          .insert(
            payload
          )
          .select(
            "id"
          )
          .single();

      if (
        error
      ) {
        throw error;
      }

      visitId =
        data.id;
    }

    const criteriaRows =
      criteria.map(
        criterion => ({
          visit_id:
            visitId,

          criterion_no:
            num(
              criterion.id
            ),

          rating:
            num(
              ratingsMap[
                num(
                  criterion.id
                )
              ]
            ),

          note:
            $(
              `criterionNote_${criterion.id}`
            )?.value ||
            null
        })
      );

    const criteriaResponse =
      await sb
        .from(
          "visit_criteria"
        )
        .upsert(
          criteriaRows,
          {
            onConflict:
              "visit_id,criterion_no"
          }
        );

    if (
      criteriaResponse.error
    ) {
      throw criteriaResponse.error;
    }

    await upsertSingle(
      "visit_feedback",
      visitId,
      {
        strengths:
          $("strengths")
            .value ||
          null,

        development_areas:
          $("developmentAreas")
            .value ||
          null
      }
    );

    await upsertSingle(
      "visit_skills",
      visitId,
      {
        critical_thinking:
          $("skill1").checked,

        collaboration_communication:
          $("skill2").checked,

        creativity_innovation:
          $("skill3").checked,

        information_literacy:
          $("skill4").checked,

        digital_literacy:
          $("skill5").checked,

        global_cultural_awareness:
          $("skill6").checked,

        adaptability_flexibility:
          $("skill7").checked,

        emotional_intelligence:
          $("skill8").checked
      }
    );

    await upsertSingle(
      "student_work_followup",
      visitId,
      {
        samples_count:
          $("samplesCount")
            .value
            ? num(
                $("samplesCount")
                  .value
              )
            : null,

        activities_alignment:
          $("sw1").checked,

        differentiated_levels:
          $("sw2").checked,

        higher_thinking_research_selflearning:
          $("sw3").checked,

        regular_correction:
          $("sw4").checked,

        constructive_feedback:
          $("sw5").checked,

        notes:
          $("studentWorkNotes")
            .value ||
          null
      }
    );

    /*
      عند تعديل زيارة قديمة:
      نحذف دعم نفس الزيارة
      ونبنيه من جديد حسب الاختيارات.
    */

    if (
      editingVisitId
    ) {
      const oldSupports =
        supports.filter(
          support =>
            String(
              support.source_visit_id
            ) ===
            String(
              visitId
            )
        );

      for (
        const support of oldSupports
      ) {
        await sb
          .from(
            "support_followups"
          )
          .delete()
          .eq(
            "support_action_id",
            support.id
          );
      }

      await sb
        .from(
          "support_actions"
        )
        .delete()
        .eq(
          "source_visit_id",
          visitId
        );
    }

    if (
      supportType
    ) {
      const supportRows =
        selectedCriteria.map(
          criterionNo => ({
            teacher_id:
              payload.teacher_id,

            source_visit_id:
              visitId,

            criterion_no:
              criterionNo,

            support_type:
              supportType,

            support_details:
              $("supportDetails")
                .value ||
              null,

            support_date:
              payload.visit_date,

            status:
              "مفتوح",

            created_by:
              currentProfile.id
          })
        );

      const response =
        await sb
          .from(
            "support_actions"
          )
          .insert(
            supportRows
          );

      if (
        response.error
      ) {
        throw response.error;
      }
    }

    /*
      تحميل البيانات أولًا حتى تدخل الزيارة الجديدة
      ضمن المقارنة.
    */

    await loadAll();

    /*
      إنشاء المتابعة التلقائية يحتاج طبقة التحليل الكاملة؛
      لذلك ينفذ من حساب مسؤولة النظام فقط.
    */
    if (currentProfile?.role === "admin") {
      await createAutomaticFollowupsForVisit(visitId);
      await loadAll();
    }

    fillUI();

    renderAll();

    if (
      message
    ) {
      message.className =
        "message success";

      message.textContent =
        "تم حفظ الزيارة بنجاح.";
    }

    clearVisitDraft();

    clearForm();

    showView("history");
  }
  catch (
    error
  ) {
    console.error(
      error
    );

    if (
      message
    ) {
      message.className =
        "message danger";

      message.textContent =
        error.message ||
        "تعذر حفظ الزيارة.";
    }
  }
}

/* =========================================================
   AUTO SUPPORT FOLLOWUP
========================================================= */

async function createAutomaticFollowupsForVisit(
  visitId
) {
  const visit =
    visits.find(
      item =>
        String(
          item.id
        ) ===
        String(
          visitId
        )
    );

  if (!visit) {
    return;
  }

  const currentRatings =
    ratingMapForVisit(
      visitId
    );

  const candidates =
    supports.filter(
      support =>
        String(
          support.teacher_id
        ) ===
          String(
            visit.teacher_id
          ) &&
        String(
          support.source_visit_id
        ) !==
          String(
            visitId
          )
    );

  for (
    const support of candidates
  ) {
    const source =
      visits.find(
        item =>
          String(
            item.id
          ) ===
          String(
            support.source_visit_id
          )
      );

    if (
      !source ||
      String(
        source.visit_date
      ) >
      String(
        visit.visit_date
      )
    ) {
      continue;
    }

    const before =
      ratingMapForVisit(
        source.id
      )[
        num(
          support.criterion_no
        )
      ];

    const after =
      currentRatings[
        num(
          support.criterion_no
        )
      ];

    if (
      !before ||
      !after
    ) {
      continue;
    }

    const existing =
      supportFollowups.find(
        followup =>
          String(
            followup.support_action_id
          ) ===
            String(
              support.id
            ) &&
          String(
            followup.followup_visit_id
          ) ===
            String(
              visitId
            )
      );

    const change =
      changeInfo(
        before,
        after
      );

    const assessment =
      change.label ===
        "تحسن"
        ? "أثر واضح"
        : change.label ===
            "استقرار"
          ? "لم يظهر أثر بعد"
          : "يحتاج متابعة إضافية";

    const payload = {
      support_action_id:
        support.id,

      followup_visit_id:
        visitId,

      before_rating:
        before,

      after_rating:
        after,

      leadership_assessment:
        assessment,

      followup_note:
        `التغير المرصود: ${change.label}`
    };

    if (
      existing
    ) {
      await sb
        .from(
          "support_followups"
        )
        .update(
          payload
        )
        .eq(
          "id",
          existing.id
        );
    }
    else {
      await sb
        .from(
          "support_followups"
        )
        .insert(
          payload
        );
    }

    await sb
      .from(
        "support_actions"
      )
      .update(
        {
          status:
            "تحت المتابعة"
        }
      )
      .eq(
        "id",
        support.id
      );
  }
}

/* =========================================================
   VIEW VISIT
========================================================= */

window.viewVisit =
  function (
    id
  ) {
    const visit =
      visits.find(
        item =>
          String(
            item.id
          ) ===
          String(
            id
          )
      );

    if (!visit) {
      return;
    }

    const map =
      maps();

    const ratingsMap =
      ratingMapForVisit(
        id
      );

    $("modalRoot").innerHTML =
      `
        <div
          class="modal-backdrop"
          onclick="
            if(event.target===this)
              this.remove()
          "
        >

          <div class="modal-card visit-details-modal">

            <div class="modal-head">

              <h3>
                تفاصيل الزيارة
              </h3>

              <button
                onclick="
                  this.closest('.modal-backdrop').remove()
                "
              >
                ×
              </button>

            </div>


            <p>
              <strong>
                المعلمة:
              </strong>

              ${esc(
                map.teachers[
                  String(
                    visit.teacher_id
                  )
                ]?.full_name ||
                "—"
              )}
            </p>


            <p>
              <strong>
                المقيم:
              </strong>

              ${esc(
                evaluatorName(
                  visit
                )
              )}
              —
              ${esc(
                evaluatorLevel(
                  visit
                )
              )}
            </p>


            <p>
              <strong>
                التاريخ:
              </strong>

              ${formatDate(
                visit.visit_date
              )}
            </p>


            <p>
              <strong>
                الحكم:
              </strong>

              ${ratingLabel(
                visit.overall_rating
              )}
            </p>


            <div class="table-wrap">

              <table>

                <thead>

                  <tr>
                    <th>المعيار</th>
                    <th>الرصد</th>
                  </tr>

                </thead>

                <tbody>

                  ${
                    criteria
                      .map(
                        criterion => `
                          <tr>

                            <td>
                              م${criterion.id}
                              —
                              ${esc(
                                criterion.criterion_text
                              )}
                            </td>

                            <td>
                              ${ratingShort(
                                ratingsMap[
                                  num(
                                    criterion.id
                                  )
                                ]
                              )}
                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  }

                </tbody>

              </table>

            </div>

          </div>

        </div>
      `;
  };

/* =========================================================
   EDIT VISIT
========================================================= */

window.editVisit =
  function (
    id
  ) {
    const visit =
      visits.find(
        item =>
          String(
            item.id
          ) ===
          String(
            id
          )
      );

    if (!visit) {
      return;
    }

    editingVisitId =
      id;

    $("teacherSelect").value =
      visit.teacher_id;

    $("departmentSelect").value =
      visit.department_id;

    updateSubjectSelect(
      visit.subject_id
    );

    $("visitDate").value =
      visit.visit_date;

    $("visitNumber").value =
      visit.visit_number ||
      "";

    $("gradeSection").value =
      visit.grade_section ||
      "";

    $("periodName").value =
      visit.period_name ||
      "";

    $("lessonTitle").value =
      visit.lesson_title ||
      "";

    $("studentsCount").value =
      visit.students_count ||
      "";

    $("absentCount").value =
      visit.absent_count ||
      "";

    $("overallRating").value =
      visit.overall_rating ||
      "";

    $("generalNotes").value =
      visit.general_notes ||
      "";

    if (
      currentProfile?.role ===
        "admin" &&
      $("visitObserverSelect")
    ) {
      $("visitObserverSelect").value =
        visit.observer_id ||
        "";
    }

    const ratingsMap =
      ratingMapForVisit(
        id
      );

    criteria.forEach(
      criterion => {
        const radio =
          document.querySelector(
            `input[name="criterion_${criterion.id}"][value="${ratingsMap[num(criterion.id)]}"]`
          );

        if (
          radio
        ) {
          radio.checked =
            true;
        }

        const ratingRow =
          ratingsForVisit(
            id
          )
            .find(
              item =>
                num(
                  item.criterion_no
                ) ===
                num(
                  criterion.id
                )
            );

        const note =
          $(
            `criterionNote_${criterion.id}`
          );

        if (
          note
        ) {
          note.value =
            ratingRow?.note ||
            "";
        }
      }
    );

    const feedbackRow =
      feedback.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    $("strengths").value =
      feedbackRow?.strengths ||
      "";

    $("developmentAreas").value =
      feedbackRow?.development_areas ||
      "";

    const skillRow =
      visitSkills.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    SKILLS.forEach(
      (
        [
          key
        ],
        index
      ) => {
        const checkbox =
          $(
            `skill${index + 1}`
          );

        if (
          checkbox
        ) {
          checkbox.checked =
            !!skillRow?.[
              key
            ];
        }
      }
    );

    const workRow =
      studentWork.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    if (
      $("samplesCount")
    ) {
      $("samplesCount").value =
        workRow?.samples_count ||
        "";
    }

    WORK_ITEMS.forEach(
      (
        [
          key
        ],
        index
      ) => {
        const checkbox =
          $(
            `sw${index + 1}`
          );

        if (
          checkbox
        ) {
          checkbox.checked =
            !!workRow?.[
              key
            ];
        }
      }
    );

    if (
      $("studentWorkNotes")
    ) {
      $("studentWorkNotes").value =
        workRow?.notes ||
        "";
    }

    document
      .querySelectorAll(
        ".support-criterion-check"
      )
      .forEach(
        item =>
          item.checked =
            false
      );

    const supportRows =
      supports.filter(
        item =>
          String(
            item.source_visit_id
          ) ===
          String(
            id
          )
      );

    if (
      supportRows.length
    ) {
      $("supportType").value =
        supportRows[0]
          .support_type ||
        "";

      $("supportDetails").value =
        supportRows[0]
          .support_details ||
        "";

      supportRows.forEach(
        support => {
          const checkbox =
            document.querySelector(
              `.support-criterion-check[value="${support.criterion_no}"]`
            );

          if (
            checkbox
          ) {
            checkbox.checked =
              true;
          }
        }
      );
    }
    else {
      $("supportType").value =
        "";

      $("supportDetails").value =
        "";
    }

    updateEvaluatorBlock();

    updateConsistencyHint();

    saveVisitDraft();

    showView(
      "newVisit"
    );
  };

/* =========================================================
   DELETE VISIT
========================================================= */

window.deleteVisit =
  async function (
    id
  ) {
    if (
      !confirm(
        "هل أنتِ متأكدة من حذف الزيارة؟"
      )
    ) {
      return;
    }

    let {
      error
    } =
      await sb.rpc(
        "delete_visit_authorized",
        {
          p_visit_id:
            id
        }
      );

    if (
      error &&
      /function .* does not exist|Could not find the function/i.test(
        error.message || ""
      )
    ) {
      const legacy =
        await sb.rpc(
          "admin_delete_visit",
          {
            p_visit_id:
              id
          }
        );

      error =
        legacy.error;
    }

    if (
      error
    ) {
      alert(
        "تعذر حذف الزيارة: " +
        (
          error.message ||
          "تحققي من صلاحيات الحساب."
        )
      );

      return;
    }

    await loadAll();

    fillUI();

    renderAll();
  };

/* =========================================================
   PRINT VISIT
========================================================= */

window.printVisitForm =
  function (
    id
  ) {
    const visit =
      visits.find(
        item =>
          String(
            item.id
          ) ===
          String(
            id
          )
      );

    if (!visit) {
      return;
    }

    const map =
      maps();

    const teacher =
      map.teachers[
        String(
          visit.teacher_id
        )
      ];

    const department =
      map.departments[
        String(
          visit.department_id
        )
      ];

    const subject =
      map.subjects[
        String(
          visit.subject_id
        )
      ];

    const ratingsMap =
      ratingMapForVisit(
        id
      );

    const feedbackRow =
      feedback.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    const skillRow =
      visitSkills.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    const workRow =
      studentWork.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    const groupedDomains =
      [
        ...new Set(
          criteria.map(
            criterion =>
              criterion.domain_name
          )
        )
      ];

    const criteriaHTML =
      groupedDomains
        .map(
          domain => `
            <tr class="domain-title">
              <td colspan="6">
                ${esc(
                  domain
                )}
              </td>
            </tr>

            ${
              criteria
                .filter(
                  criterion =>
                    criterion.domain_name ===
                    domain
                )
                .map(
                  criterion => {
                    const value =
                      num(
                        ratingsMap[
                          num(
                            criterion.id
                          )
                        ]
                      );

                    const mark =
                      level =>
                        value ===
                        level
                          ? "✓"
                          : "";

                    return `
                      <tr>
                        <td class="criterion-text">
                          <strong>
                            م${criterion.id}
                          </strong>
                          —
                          ${esc(
                            criterion.criterion_text
                          )}
                          ${
                            criterion.is_evaluation_key
                              ? `
                                  <span class="key-badge">
                                    مفتاح تقييم
                                  </span>
                                `
                              : ""
                          }
                        </td>

                        <td class="rating-cell level-1">
                          ${mark(1)}
                        </td>

                        <td class="rating-cell level-2">
                          ${mark(2)}
                        </td>

                        <td class="rating-cell level-3">
                          ${mark(3)}
                        </td>

                        <td class="rating-cell level-4">
                          ${mark(4)}
                        </td>

                        <td class="note-cell">
                          ${esc(
                            ratingsForVisit(
                              id
                            ).find(
                              row =>
                                num(
                                  row.criterion_no
                                ) ===
                                num(
                                  criterion.id
                                )
                            )?.note ||
                            ""
                          )}
                        </td>
                      </tr>
                    `;
                  }
                )
                .join("")
            }
          `
        )
        .join("");

    const printWindow =
      window.open(
        "",
        "_blank"
      );

    if (!printWindow) {
      alert(
        "يرجى السماح بالنوافذ المنبثقة حتى يمكن طباعة الاستمارة."
      );

      return;
    }

    printWindow.document.write(
      `
        <!doctype html>

        <html
          lang="ar"
          dir="rtl"
        >

          <head>

            <meta charset="utf-8">

            <meta
              name="viewport"
              content="width=device-width,initial-scale=1"
            >

            <title>
              استمارة الملاحظة الصفية الموحدة
            </title>

            <style>

              * {
                box-sizing:
                  border-box;
              }

              body {
                margin:
                  0;
                padding:
                  10mm;
                font-family:
                  Tahoma,
                  Arial,
                  sans-serif;
                color:
                  #163a3e;
                background:
                  #fff;
                font-size:
                  11px;
                line-height:
                  1.55;
              }

              .sheet {
                width:
                  100%;
                margin:
                  0 auto;
              }

              .school-header {
                text-align:
                  center;
                margin-bottom:
                  8px;
              }

              .school-header img {
                max-width:
                  100%;
                max-height:
                  95px;
                object-fit:
                  contain;
              }

              .title {
                text-align:
                  center;
                margin:
                  5px 0 10px;
              }

              .title h1 {
                margin:
                  0;
                color:
                  #0d5f66;
                font-size:
                  19px;
              }

              .title p {
                margin:
                  3px 0 0;
                color:
                  #526b6e;
              }

              .info-grid {
                display:
                  grid;
                grid-template-columns:
                  repeat(4,1fr);
                border:
                  1px solid #9db8ba;
                border-bottom:
                  0;
              }

              .info-item {
                min-height:
                  42px;
                border-left:
                  1px solid #9db8ba;
                border-bottom:
                  1px solid #9db8ba;
                padding:
                  5px 7px;
              }

              .info-item:nth-child(4n) {
                border-left:
                  0;
              }

              .info-label {
                display:
                  block;
                color:
                  #5c7477;
                font-size:
                  9px;
                margin-bottom:
                  2px;
              }

              .info-value {
                font-weight:
                  700;
                color:
                  #163a3e;
              }

              .overall-box {
                margin:
                  8px 0;
                border:
                  2px solid #0d5f66;
                background:
                  #eef6f6;
                padding:
                  7px 10px;
                display:
                  flex;
                justify-content:
                  space-between;
                align-items:
                  center;
                gap:
                  10px;
              }

              .overall-box strong {
                font-size:
                  13px;
              }

              table {
                width:
                  100%;
                border-collapse:
                  collapse;
                table-layout:
                  fixed;
              }

              th,
              td {
                border:
                  1px solid #9db8ba;
                padding:
                  4px;
                vertical-align:
                  middle;
              }

              thead th {
                background:
                  #0d5f66;
                color:
                  #fff;
                font-size:
                  9px;
                text-align:
                  center;
              }

              .criterion-text {
                width:
                  39%;
                text-align:
                  right;
              }

              .rating-head {
                width:
                  9%;
              }

              .note-head,
              .note-cell {
                width:
                  25%;
              }

              .rating-cell {
                text-align:
                  center;
                font-size:
                  15px;
                font-weight:
                  900;
              }

              .level-1 {
                background:
                  #faecec;
              }

              .level-2 {
                background:
                  #fbf2df;
              }

              .level-3 {
                background:
                  #e8f3ed;
              }

              .level-4 {
                background:
                  #dceeed;
              }

              .domain-title td {
                background:
                  #dcebec;
                color:
                  #0d5f66;
                font-weight:
                  800;
                padding:
                  5px 7px;
              }

              .key-badge {
                display:
                  inline-block;
                margin-right:
                  4px;
                padding:
                  1px 5px;
                border-radius:
                  8px;
                background:
                  #f2e4bd;
                color:
                  #76581b;
                font-size:
                  8px;
              }

              .section {
                margin-top:
                  9px;
                border:
                  1px solid #9db8ba;
                break-inside:
                  avoid;
              }

              .section-title {
                padding:
                  5px 8px;
                background:
                  #eaf3f3;
                color:
                  #0d5f66;
                font-weight:
                  800;
              }

              .section-body {
                padding:
                  7px 9px;
              }

              .check-grid {
                display:
                  grid;
                grid-template-columns:
                  repeat(2,1fr);
                gap:
                  4px 12px;
              }

              .check-item {
                border-bottom:
                  1px dotted #b9c9ca;
                padding:
                  3px 0;
              }

              .yes {
                font-weight:
                  800;
                color:
                  #0d5f66;
              }

              .feedback-grid {
                display:
                  grid;
                grid-template-columns:
                  1fr 1fr;
                gap:
                  8px;
              }

              .feedback-box {
                min-height:
                  68px;
                border:
                  1px solid #c1d0d1;
                padding:
                  7px;
              }

              .feedback-box strong {
                display:
                  block;
                color:
                  #0d5f66;
                margin-bottom:
                  4px;
              }

              .teacher-approval {
                margin-top:
                  12px;
                border:
                  2px solid #0d5f66;
                padding:
                  10px;
                break-inside:
                  avoid;
              }

              .teacher-approval h3 {
                margin:
                  0 0 8px;
                color:
                  #0d5f66;
                font-size:
                  13px;
              }

              .approval-grid {
                display:
                  grid;
                grid-template-columns:
                  2fr 1fr 1fr;
                gap:
                  12px;
              }

              .signature-line {
                border-bottom:
                  1px solid #6d7f81;
                min-height:
                  24px;
                padding-bottom:
                  3px;
              }

              .management-signatures {
                margin-top:
                  14px;
                padding-top:
                  10px;
                border-top:
                  2px solid #0d5f66;
                display:
                  grid;
                grid-template-columns:
                  repeat(3,1fr);
                gap:
                  14px;
                text-align:
                  center;
                break-inside:
                  avoid;
              }

              .management-signatures span {
                display:
                  block;
                color:
                  #61787b;
                font-size:
                  9px;
                margin-bottom:
                  3px;
              }

              .management-signatures strong {
                font-size:
                  11px;
              }

              .print-btn {
                margin-top:
                  12px;
                padding:
                  8px 18px;
                border:
                  0;
                border-radius:
                  7px;
                background:
                  #0d5f66;
                color:
                  #fff;
                cursor:
                  pointer;
              }

              @page {
                size:
                  A4 portrait;
                margin:
                  8mm;
              }

              @media print {

                body {
                  padding:
                    0;
                }

                .print-btn {
                  display:
                    none;
                }

                thead {
                  display:
                    table-header-group;
                }

                tr,
                .section,
                .teacher-approval,
                .management-signatures {
                  break-inside:
                    avoid;
                }

              }

            </style>

          </head>

          <body>

            <div class="sheet">

              <div class="school-header">
                <img
                  src="${SCHOOL_HEADER_IMAGE}"
                  alt="الترويسة الرسمية"
                >
              </div>

              <div class="title">
                <h1>
                  استمارة الملاحظة الصفية الموحدة
                </h1>
                <p>
                  العام الدراسي
                  ${esc(
                    visit.academic_year ||
                    APP_CONFIG.academicYear
                  )}
                </p>
              </div>

              <div class="info-grid">

                <div class="info-item">
                  <span class="info-label">
                    اسم المعلمة
                  </span>
                  <span class="info-value">
                    ${esc(
                      teacher?.full_name ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    القسم
                  </span>
                  <span class="info-value">
                    ${esc(
                      department?.name ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    المادة
                  </span>
                  <span class="info-value">
                    ${esc(
                      subject?.name ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    التاريخ
                  </span>
                  <span class="info-value">
                    ${formatDate(
                      visit.visit_date
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    رقم الزيارة
                  </span>
                  <span class="info-value">
                    ${esc(
                      visit.visit_number ??
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    الصف / الشعبة
                  </span>
                  <span class="info-value">
                    ${esc(
                      visit.grade_section ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    الحصة
                  </span>
                  <span class="info-value">
                    ${esc(
                      visit.period_name ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    عنوان الدرس
                  </span>
                  <span class="info-value">
                    ${esc(
                      visit.lesson_title ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    عدد الطلبة
                  </span>
                  <span class="info-value">
                    ${visit.students_count ?? "—"}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    الغياب
                  </span>
                  <span class="info-value">
                    ${visit.absent_count ?? "—"}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    منفذ الزيارة
                  </span>
                  <span class="info-value">
                    ${esc(
                      evaluatorName(
                        visit
                      )
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    المستوى القيادي
                  </span>
                  <span class="info-value">
                    ${esc(
                      evaluatorLevel(
                        visit
                      )
                    )}
                  </span>
                </div>

              </div>

              <div class="overall-box">
                <span>
                  الحكم العام للزيارة
                </span>
                <strong>
                  ${ratingLabel(
                    visit.overall_rating
                  )}
                </strong>
              </div>

              <table>

                <thead>
                  <tr>
                    <th class="criterion-text">
                      المعيار
                    </th>
                    <th class="rating-head">
                      يفي بالتوقعات جزئيًا
                    </th>
                    <th class="rating-head">
                      يفي بالتوقعات تمامًا
                    </th>
                    <th class="rating-head">
                      يتجاوز التوقعات
                    </th>
                    <th class="rating-head">
                      يتجاوز التوقعات بكثير
                    </th>
                    <th class="note-head">
                      ملاحظات
                    </th>
                  </tr>
                </thead>

                <tbody>
                  ${criteriaHTML}
                </tbody>

              </table>

              <div class="section">

                <div class="section-title">
                  مهارات القرن الحادي والعشرين
                </div>

                <div class="section-body check-grid">

                  ${
                    SKILLS.map(
                      (
                        [
                          field,
                          label
                        ]
                      ) => `
                        <div class="check-item">
                          <span class="yes">
                            ${
                              skillRow?.[
                                field
                              ] ===
                              true
                                ? "✓"
                                : "□"
                            }
                          </span>
                          ${esc(
                            label
                          )}
                        </div>
                      `
                    ).join("")
                  }

                </div>

              </div>

              <div class="section">

                <div class="section-title">
                  متابعة أعمال الطلبة
                  ${
                    workRow?.samples_count
                      ? ` — عدد العينات: ${workRow.samples_count}`
                      : ""
                  }
                </div>

                <div class="section-body check-grid">

                  ${
                    WORK_ITEMS.map(
                      (
                        [
                          field,
                          label
                        ]
                      ) => `
                        <div class="check-item">
                          <span class="yes">
                            ${
                              workRow?.[
                                field
                              ] ===
                              true
                                ? "✓"
                                : "□"
                            }
                          </span>
                          ${esc(
                            label
                          )}
                        </div>
                      `
                    ).join("")
                  }

                </div>

              </div>

              <div class="section">

                <div class="section-title">
                  التغذية الراجعة
                </div>

                <div class="section-body feedback-grid">

                  <div class="feedback-box">
                    <strong>
                      نجاحات المعلمة / نقاط القوة
                    </strong>
                    ${esc(
                      feedbackRow?.strengths ||
                      "—"
                    )}
                  </div>

                  <div class="feedback-box">
                    <strong>
                      جوانب بحاجة إلى تطوير
                    </strong>
                    ${esc(
                      feedbackRow?.development_areas ||
                      "—"
                    )}
                  </div>

                </div>

              </div>

              ${
                visit.general_notes
                  ? `
                      <div class="section">

                        <div class="section-title">
                          ملاحظات عامة
                        </div>

                        <div class="section-body">
                          ${esc(
                            visit.general_notes
                          )}
                        </div>

                      </div>
                    `
                  : ""
              }

              <div class="teacher-approval">

                <h3>
                  اعتماد المعلمة على الاطلاع
                </h3>

                <div class="approval-grid">

                  <div>
                    <span>
                      اسم المعلمة
                    </span>
                    <div class="signature-line">
                      ${esc(
                        teacher?.full_name ||
                        "—"
                      )}
                    </div>
                  </div>

                  <div>
                    <span>
                      التوقيع
                    </span>
                    <div class="signature-line">
                      &nbsp;
                    </div>
                  </div>

                  <div>
                    <span>
                      التاريخ
                    </span>
                    <div class="signature-line">
                      &nbsp;
                    </div>
                  </div>

                </div>

              </div>

              <div class="management-signatures">

                <div>
                  <span>
                    إعداد ومتابعة النظام
                  </span>
                  <strong>
                    ${REPORT_INFO.preparedBy}
                  </strong>
                </div>

                <div>
                  <span>
                    المديرة المساعدة
                  </span>
                  <strong>
                    ${REPORT_INFO.assistantPrincipal}
                  </strong>
                </div>

                <div>
                  <span>
                    مديرة المدرسة
                  </span>
                  <strong>
                    ${REPORT_INFO.principal}
                  </strong>
                </div>

              </div>

              <button
                class="print-btn"
                onclick="window.print()"
              >
                طباعة الاستمارة
              </button>

            </div>

          </body>

        </html>
      `
    );

    printWindow.document.close();
  };

/* =========================================================
   USERS
========================================================= */

function renderUsers() {
  const box =
    $("usersContent");

  if (
    !box ||
    currentProfile?.role !==
      "admin"
  ) {
    return;
  }

  const departmentOptions =
    activeRows(
      departments
    )
      .map(
        department => `
          <option
            value="${department.id}"
          >
            ${esc(
              department.name
            )}
          </option>
        `
      )
      .join("");

  box.innerHTML =
    `
      <div class="panel">

        <div class="panel-head">
          <div>
            <span class="panel-kicker">USER ACCESS</span>
            <h3>إضافة مستخدم جديد</h3>
            <p>أنشئي الحساب ببريد المستخدم وكلمة مرور مؤقتة. لا يتم حفظ كلمة المرور داخل جدول profiles.</p>
          </div>
        </div>

        <form
          id="platformUserForm"
        >

          <div class="form-grid three">

            <label>
              الاسم
              <input
                id="platformUserName"
                autocomplete="off"
                required
              >
            </label>

            <label>
              البريد الإلكتروني
              <input
                id="platformUserEmail"
                type="email"
                dir="ltr"
                autocomplete="off"
                required
              >
            </label>

            <label>
              الصفة الوظيفية
              <select
                id="platformUserJobTitle"
                required
              >
                <option value="">اختاري الصفة</option>
                <option>مديرة المدرسة</option>
                <option>مديرة مساعدة</option>
                <option>منسقة قسم</option>
                <option>معلم أول</option>
                <option>مسؤولة النظام</option>
              </select>
            </label>

            <label
              id="platformUserDeptWrap"
              class="hidden"
            >
              القسم
              <select
                id="platformUserDepartment"
              >
                <option value="">اختاري القسم</option>
                ${departmentOptions}
              </select>
            </label>

            <label>
              كلمة المرور المؤقتة
              <input
                id="platformUserPassword"
                type="password"
                minlength="8"
                autocomplete="new-password"
                placeholder="8 أحرف على الأقل"
                required
              >
            </label>

            <label>
              تأكيد كلمة المرور
              <input
                id="platformUserPasswordConfirm"
                type="password"
                minlength="8"
                autocomplete="new-password"
                placeholder="أعيدي كتابة كلمة المرور"
                required
              >
            </label>

          </div>

          <div
            id="platformUserAutoLevel"
            class="analysis-note"
          >
            المستوى القيادي يحدد تلقائيًا.
          </div>

          <div class="analysis-note">
            كلمة المرور تُرسل إلى Supabase Auth فقط ولا تُخزن في بيانات المنصة.
          </div>

          <div class="form-actions">
            <button
              id="platformUserSubmit"
              class="btn btn-primary"
              type="submit"
            >
              إضافة المستخدم
            </button>
          </div>

          <div
            id="platformUserMsg"
            class="message"
          ></div>

        </form>

      </div>


      <div class="panel">

        <div class="panel-head">
          <div>
            <span class="panel-kicker">REGISTERED USERS</span>
            <h3>المستخدمون المسجلون</h3>
            <p>يمكن لمسؤولة النظام تعيين كلمة مرور جديدة لأي حساب عند الحاجة.</p>
          </div>
        </div>

        <div class="table-wrap">

          <table>

            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد</th>
                <th>الصفة</th>
                <th>المستوى القيادي</th>
                <th>القسم</th>
                <th>الحالة</th>
                <th>إدارة المستخدم</th>
              </tr>
            </thead>

            <tbody>
              ${
                profiles
                  .map(
                    profile => `
                      <tr>
                        <td>${esc(profile.full_name || "—")}</td>
                        <td dir="ltr">${esc(profile.email || "—")}</td>
                        <td>
                          ${esc(
                            profile.job_title ||
                            (
                              profile.role === "admin"
                                ? "مسؤولة النظام"
                                : "—"
                            )
                          )}
                        </td>
                        <td>${esc(leadershipLevel(profile))}</td>
                        <td>
                          ${esc(
                            departments.find(
                              department =>
                                String(department.id) ===
                                String(profile.department_id)
                            )?.name || "—"
                          )}
                        </td>
                        <td>
                          ${
                            profile.active === false
                              ? "غير نشط"
                              : "نشط"
                          }
                        </td>
                        <td>
                          <div class="user-action-group">
                            <button
                              type="button"
                              class="btn btn-soft platform-edit-user-btn"
                              data-user-id="${esc(profile.id)}"
                            >تعديل</button>
                            <button
                              type="button"
                              class="btn btn-soft platform-password-btn"
                              data-user-id="${esc(profile.id)}"
                              data-user-name="${esc(profile.full_name || profile.email || "المستخدم")}"
                            >تعيين كلمة مرور</button>
                            ${profile.role === "admin" ? "" : `
                            <button
                              type="button"
                              class="btn btn-soft platform-toggle-user-btn"
                              data-user-id="${esc(profile.id)}"
                              data-user-active="${profile.active === false ? "false" : "true"}"
                            >${profile.active === false ? "تفعيل" : "تعطيل"}</button>`}
                          </div>
                        </td>
                      </tr>
                    `
                  )
                  .join("")
              }
            </tbody>

          </table>

        </div>

      </div>
    `;

  const syncJob =
    () => {
      const job =
        $("platformUserJobTitle")
          ?.value ||
        "";

      const coordinator =
        job ===
        "منسقة قسم";

      $("platformUserDeptWrap")
        ?.classList
        .toggle(
          "hidden",
          !coordinator
        );

      if (
        $("platformUserDepartment")
      ) {
        $("platformUserDepartment").required =
          coordinator;
      }

      let level =
        "يحدد تلقائيًا";

      if (
        job === "مديرة المدرسة" ||
        job === "مديرة مساعدة"
      ) {
        level =
          "قيادة عليا";
      }
      else if (
        job === "منسقة قسم"
      ) {
        level =
          "قيادة وسطى";
      }
      else if (
        job === "مسؤولة النظام"
      ) {
        level =
          "لا ينطبق";
      }

      if (
        $("platformUserAutoLevel")
      ) {
        $("platformUserAutoLevel").textContent =
          `المستوى القيادي: ${level}`;
      }
    };

  $("platformUserJobTitle")
    ?.addEventListener(
      "change",
      syncJob
    );

  syncJob();

  $("platformUserForm")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const full_name =
          $("platformUserName")
            .value
            .trim();

        const email =
          $("platformUserEmail")
            .value
            .trim()
            .toLowerCase();

        const job_title =
          $("platformUserJobTitle")
            .value;

        const department_id =
          job_title === "منسقة قسم"
            ? num(
                $("platformUserDepartment")
                  .value
              )
            : null;

        const password =
          $("platformUserPassword")
            .value;

        const passwordConfirm =
          $("platformUserPasswordConfirm")
            .value;

        const message =
          $("platformUserMsg");

        const button =
          $("platformUserSubmit");

        if (
          job_title === "منسقة قسم" &&
          !department_id
        ) {
          message.className =
            "message danger";
          message.textContent =
            "اختاري القسم للمنسقة.";
          return;
        }

        if (
          password.length < 8
        ) {
          message.className =
            "message danger";
          message.textContent =
            "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
          return;
        }

        if (
          password !==
          passwordConfirm
        ) {
          message.className =
            "message danger";
          message.textContent =
            "كلمتا المرور غير متطابقتين.";
          return;
        }

        try {
          button.disabled =
            true;
          button.textContent =
            "جاري الإنشاء...";

          const {
            data,
            error
          } =
            await sb.functions.invoke(
              "manage-users",
              {
                body: {
                  action: "create",
                  full_name,
                  email,
                  job_title,
                  department_id,
                  password
                }
              }
            );

          if (error) {
            throw error;
          }

          if (!data?.ok) {
            throw new Error(
              data?.error ||
              "تعذر إنشاء المستخدم."
            );
          }

          message.className =
            "message success";
          message.textContent =
            "تم إنشاء المستخدم بنجاح ويمكنه تسجيل الدخول بالبريد وكلمة المرور المحددة.";

          await loadAll();
          fillUI();
          renderUsers();
        }
        catch (error) {
          message.className =
            "message danger";
          message.textContent =
            error.message ||
            "تعذر إنشاء المستخدم.";
        }
        finally {
          if (button) {
            button.disabled =
              false;
            button.textContent =
              "إضافة المستخدم";
          }
        }
      }
    );

  document
    .querySelectorAll(".platform-edit-user-btn")
    .forEach(button => button.addEventListener("click", async () => {
      const profile = profiles.find(item => String(item.id) === String(button.dataset.userId));
      if (!profile) return;

      const fullName = window.prompt("الاسم:", profile.full_name || "");
      if (fullName === null) return;
      const jobTitle = window.prompt(
        "الصفة الوظيفية (مديرة المدرسة / مديرة مساعدة / منسقة قسم / معلم أول / مسؤولة النظام):",
        profile.job_title || ""
      );
      if (jobTitle === null) return;
      const level = window.prompt(
        "المستوى القيادي (قيادة عليا / قيادة وسطى / لا ينطبق):",
        leadershipLevel(profile)
      );
      if (level === null) return;
      if (!["قيادة عليا", "قيادة وسطى", "لا ينطبق"].includes(level.trim())) {
        alert("المستوى القيادي غير صحيح.");
        return;
      }

      let departmentId = profile.department_id || null;
      if (jobTitle.trim() === "منسقة قسم") {
        const currentDepartment = departments.find(d => String(d.id) === String(profile.department_id));
        const deptName = window.prompt("اسم القسم:", currentDepartment?.name || "");
        if (deptName === null) return;
        const department = departments.find(d => (d.name || "").trim() === deptName.trim());
        if (!department) {
          alert("لم يتم العثور على القسم. اكتبي اسم القسم كما هو مسجل في المنصة.");
          return;
        }
        departmentId = department.id;
      } else {
        departmentId = null;
      }

      try {
        button.disabled = true;
        const { error } = await sb.from("profiles").update({
          full_name: fullName.trim(),
          job_title: jobTitle.trim(),
          leadership_level: level.trim() === "لا ينطبق" ? null : level.trim(),
          department_id: departmentId
        }).eq("id", profile.id);
        if (error) throw error;
        await loadAll();
        fillUI();
        renderUsers();
        alert("تم تحديث بيانات المستخدم والمستوى القيادي بنجاح.");
      } catch (error) {
        alert(error.message || "تعذر تحديث بيانات المستخدم.");
      } finally {
        button.disabled = false;
      }
    }));

  document
    .querySelectorAll(".platform-toggle-user-btn")
    .forEach(button => button.addEventListener("click", async () => {
      const active = button.dataset.userActive === "true";
      const verb = active ? "تعطيل" : "تفعيل";
      if (!window.confirm(`هل تريدين ${verb} هذا المستخدم؟`)) return;
      try {
        button.disabled = true;
        const { error } = await sb.from("profiles").update({ active: !active }).eq("id", button.dataset.userId);
        if (error) throw error;
        await loadAll();
        fillUI();
        renderUsers();
      } catch (error) {
        alert(error.message || `تعذر ${verb} المستخدم.`);
      } finally {
        button.disabled = false;
      }
    }));

  document
    .querySelectorAll(
      ".platform-password-btn"
    )
    .forEach(
      button =>
        button.addEventListener(
          "click",
          async () => {
            const userId =
              button.dataset.userId;
            const userName =
              button.dataset.userName ||
              "المستخدم";

            const password =
              window.prompt(
                `اكتبي كلمة المرور الجديدة لـ ${userName} (8 أحرف على الأقل):`
              );

            if (password === null) {
              return;
            }

            if (
              password.length < 8
            ) {
              alert(
                "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
              );
              return;
            }

            const confirmPassword =
              window.prompt(
                "أعيدي كتابة كلمة المرور للتأكيد:"
              );

            if (
              confirmPassword !==
              password
            ) {
              alert(
                "كلمتا المرور غير متطابقتين."
              );
              return;
            }

            try {
              button.disabled =
                true;
              button.textContent =
                "جاري الحفظ...";

              const {
                data,
                error
              } =
                await sb.functions.invoke(
                  "manage-users",
                  {
                    body: {
                      action: "set-password",
                      user_id: userId,
                      password
                    }
                  }
                );

              if (error) {
                throw error;
              }

              if (!data?.ok) {
                throw new Error(
                  data?.error ||
                  "تعذر تحديث كلمة المرور."
                );
              }

              alert(
                `تم تعيين كلمة المرور لـ ${userName} بنجاح.`
              );
            }
            catch (error) {
              alert(
                error.message ||
                "تعذر تحديث كلمة المرور."
              );
            }
            finally {
              button.disabled =
                false;
              button.textContent =
                "تعيين كلمة مرور";
            }
          }
        )
    );
}

/* =========================================================
   MASTER DATA
========================================================= */

function renderTeacherDepartmentManager() {
  const out = $("teacherDepartmentManager");
  if (!out) return;

  const deptOptions = activeRows(departments)
    .map(d => `<option value="${d.id}">${esc(d.name)}</option>`)
    .join("");

  const rows = [...teachers]
    .sort((a,b) => String(a.full_name || "").localeCompare(String(b.full_name || ""), "ar"))
    .map(t => `
      <tr>
        <td>${esc(t.full_name || "—")}</td>
        <td>
          <select class="teacher-dept-edit" data-teacher-id="${t.id}" ${t.active === false ? "disabled" : ""}>
            <option value="">غير مرتبط</option>
            ${deptOptions.replace(`value="${t.department_id}"`, `value="${t.department_id}" selected`)}
          </select>
        </td>
        <td>${t.active === false ? "غير نشطة" : "نشطة"}</td>
        <td>
          <button class="btn teacher-active-toggle" type="button" data-teacher-id="${t.id}" data-active="${t.active !== false}">
            ${t.active === false ? "إعادة تفعيل" : "تعطيل"}
          </button>
        </td>
      </tr>`).join("");

  out.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>اسم المعلمة</th><th>القسم</th><th>الحالة</th><th>إجراء</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">لا توجد معلمات.</td></tr>'}</tbody>
      </table>
    </div>
    <div id="teacherDepartmentMsg" class="message"></div>`;

  out.querySelectorAll(".teacher-dept-edit").forEach(select => {
    select.addEventListener("change", async () => {
      const teacherId = Number(select.dataset.teacherId);
      const departmentId = select.value ? Number(select.value) : null;
      const msg = $("teacherDepartmentMsg");
      select.disabled = true;
      const { error } = await sb.from("teachers").update({ department_id: departmentId }).eq("id", teacherId);
      if (error) {
        if (msg) msg.textContent = error.message;
      } else {
        if (msg) msg.textContent = "تم تحديث قسم المعلمة.";
        await loadAll();
        fillUI();
        renderAll();
      }
      select.disabled = false;
    });
  });

  out.querySelectorAll(".teacher-active-toggle").forEach(button => {
    button.addEventListener("click", async () => {
      const teacherId = Number(button.dataset.teacherId);
      const isActive = button.dataset.active === "true";
      const msg = $("teacherDepartmentMsg");
      button.disabled = true;
      const { error } = await sb.from("teachers").update({ active: !isActive }).eq("id", teacherId);
      if (error) {
        if (msg) msg.textContent = error.message;
        button.disabled = false;
        return;
      }
      await loadAll();
      fillUI();
      renderAll();
      if ($("teacherDepartmentMsg")) $("teacherDepartmentMsg").textContent = isActive ? "تم تعطيل المعلمة." : "تمت إعادة تفعيل المعلمة.";
    });
  });
}

function renderMasterSummary() {
  if (
    $("masterSummary")
  ) {
    $("masterSummary").innerHTML =
      `
        <div class="executive-kpi-grid">

          <article class="executive-kpi">

            <span>
              المعلمات
            </span>

            <strong>
              ${activeRows(teachers).length}
            </strong>

          </article>


          <article class="executive-kpi">

            <span>
              الأقسام
            </span>

            <strong>
              ${activeRows(departments).length}
            </strong>

          </article>


          <article class="executive-kpi">

            <span>
              المواد
            </span>

            <strong>
              ${activeRows(subjects).length}
            </strong>

          </article>


          <article class="executive-kpi">

            <span>
              المعايير
            </span>

            <strong>
              ${criteria.length}
            </strong>

          </article>

        </div>
      `;
  }
}

/* =========================================================
   NAVIGATION
========================================================= */

const VIEW_MAP = {
  dashboard:
    "dashboardView",

  newVisit:
    "newVisitView",

  history:
    "historyView",

  monthly:
    "monthlyView",

  overall:
    "overallView",

  leadershipTracking:
    "leadershipTrackingView",

  followupCenter:
    "followupCenterView",

  department360:
    "department360View",

  subjectCoverage:
    "subjectCoverageView",

  teacher360: "teacher360View",
  performanceProgress: "performanceProgressView",
  criteriaMatrix: "criteriaMatrixView",
  nextVisits: "nextVisitsView",
  decisionCenter: "decisionCenterView",
  dataQuality: "dataQualityView",
  athar: "atharView",

  support:
    "supportView",

  reports:
    "reportsView",

  users:
    "usersView",

  masterdata:
    "masterdataView"
};

const VIEW_TITLES = {
  dashboard:
    "الرئيسية",

  newVisit:
    "زيارة جديدة",

  history:
    "سجل الزيارات",

  monthly:
    "التحليل الشهري",

  overall:
    "التحليل الشامل",

  leadershipTracking:
    "متابعة الزيارات القيادية",

  followupCenter:
    "مركز المتابعة",

  department360:
    "تحليل القسم 360°",

  subjectCoverage:
    "تحليل المواد والتغطية",
  teacher360: "بطاقة المعلمة 360°",
  performanceProgress: "تطور الأداء التراكمي",
  criteriaMatrix: "مصفوفة م1–م18",
  nextVisits: "خطة الزيارات القادمة",
  decisionCenter: "مركز قرارات القيادة",
  dataQuality: "جودة البيانات",
  athar: "أثر | النمو والتميز المهني",

  support:
    "الدعم والمتابعة",

  reports:
    "التقارير الرسمية",

  users:
    "إدارة المستخدمين",

  masterdata:
    "البيانات الأساسية"
};

function showView(
  name
) {
  const id =
    VIEW_MAP[
      name
    ];

  if (!id) {
    return;
  }

  document
    .querySelectorAll(
      ".view"
    )
    .forEach(
      view =>
        view.classList.add(
          "hidden"
        )
    );

  $(id)
    ?.classList
    .remove(
      "hidden"
    );

  document
    .querySelectorAll(
      "[data-view]"
    )
    .forEach(
      item =>
        item.classList.remove(
          "active"
        )
    );

  document
    .querySelector(
      `[data-view="${name}"]`
    )
    ?.classList
    .add(
      "active"
    );

  if (
    $("pageTitle")
  ) {
    $("pageTitle").textContent =
      VIEW_TITLES[
        name
      ] ||
      "منظومة الزيارات الصفية";
  }

  if (
    name ===
    "dashboard"
  ) {
    renderDashboard();
  }

  if (
    name ===
    "history"
  ) {
    renderHistory();
  }

  if (
    name ===
    "monthly"
  ) {
    renderMonthly();
  }

  if (
    name ===
    "overall"
  ) {
    renderOverall();
  }

  if (name === "leadershipTracking") { renderLeadershipTracking(); }

  if (name === "followupCenter") { renderFollowupCenter(); }

  if (name === "department360") { renderDepartment360(); }

  if (name === "subjectCoverage") { renderSubjectCoverage(); }
  if (name === "teacher360") { renderTeacher360(); }
  if (name === "performanceProgress") { renderPerformanceProgress(); }
  if (name === "criteriaMatrix") { renderCriteriaMatrix(); }
  if (name === "nextVisits") { renderNextVisits(); }
  if (name === "decisionCenter") { renderDecisionCenter(); }
  if (name === "dataQuality") { renderDataQuality(); }
  if (name === "athar") { renderAthar(); }

  if (
    name ===
    "support"
  ) {
    renderSupport();
  }

  if (
    name ===
    "users"
  ) {
    renderUsers();
  }

  if (
    name ===
    "masterdata"
  ) {
    renderMasterSummary();
  }

  if (
    name ===
    "reports"
  ) {
    generateReport();
  }

  if (
    name ===
    "newVisit"
  ) {
    updateEvaluatorBlock();
  }
}

function bindNavigation() {
  document
    .querySelectorAll(
      "[data-view]"
    )
    .forEach(
      item =>
        item.addEventListener(
          "click",
          event => {
            event.preventDefault();

            const targetView =
              item.dataset.view;

            if (
              targetView === "newVisit" &&
              editingVisitId
            ) {
              clearVisitDraft();
              clearForm();
            }

            showView(
              targetView
            );
          }
        )
    );
}

/* =========================================================
   PERMISSIONS
========================================================= */

function applyPermissionsUI() {
  const admin = currentProfile?.role === "admin";

  document.querySelectorAll(".admin-only,[data-admin-only]").forEach(
    element => element.classList.toggle("hidden", !admin)
  );

  // V10.8: leadership and coordinators can again see the normal platform modules.
  // Only controls explicitly marked admin-only stay restricted to the system administrator.
  document.querySelectorAll("nav.nav button:not(.admin-only):not([data-admin-only])").forEach(button => {
    button.classList.remove("hidden");
  });
}


/* =========================================================
   CURRENT USER
========================================================= */

function renderCurrentUser() {
  if (
    $("userInfo")
  ) {
    $("userInfo").innerHTML =
      `
        <strong>

          ${esc(
            currentProfile?.full_name ||
            currentUser?.email ||
            "مستخدم"
          )}

        </strong>

        <span>

          ${esc(
            currentProfile?.job_title ||
            (
              currentProfile?.role ===
              "admin"
                ? "مسؤولة النظام"
                : "مستخدم المنصة"
            )
          )}

        </span>
      `;
  }

  if (
    $("yearBadge")
  ) {
    $("yearBadge").textContent =
      APP_CONFIG.academicYear;
  }

  updateEvaluatorBlock();
}

/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {
  renderCurrentUser();

  applyPermissionsUI();

  renderDashboard();

  renderHistory();

  renderMonthly();

  renderOverall();

  renderSupport();

  renderMasterSummary();
}

/* =========================================================
   EVENTS
========================================================= */

function bindStaticEvents() {
  $("departmentSelect")
    ?.addEventListener(
      "change",
      () =>
        updateSubjectSelect()
    );

  $("visitObserverSelect")
    ?.addEventListener(
      "change",
      updateEvaluatorBlock
    );

  document
    .addEventListener(
      "change",
      event => {
        if (
          event.target
            ?.matches?.(
              'input[name^="criterion_"]'
            ) ||
          event.target?.id ===
            "overallRating"
        ) {
          updateConsistencyHint();
        }
      }
    );

  [
    "histMonth",
    "histTeacher",
    "histDept",
    "histSubject",
    "histRating"
  ]
    .forEach(
      id =>
        $(id)
          ?.addEventListener(
            "change",
            renderHistory
          )
    );

  $("monthlyMonth")
    ?.addEventListener(
      "change",
      renderMonthly
    );

  [
    "dashboardDeptFilter",
    "dashboardTeacherFilter",
    "dashboardFromMonth",
    "dashboardToMonth"
  ].forEach(
    id =>
      $(id)
        ?.addEventListener(
          "change",
          renderDashboard
        )
  );

  [
    "monthlyDeptFilter",
    "monthlyTeacherFilter"
  ].forEach(
    id =>
      $(id)
        ?.addEventListener(
          "change",
          renderMonthly
        )
  );

  [
    "overallDeptFilter",
    "overallTeacherFilter",
    "overallFromMonth",
    "overallToMonth"
  ].forEach(
    id =>
      $(id)
        ?.addEventListener(
          "change",
          renderOverall
        )
  );

  [
    "reportDeptFilter",
    "reportTeacherFilter",
    "reportFromMonth",
    "reportToMonth"
  ].forEach(
    id =>
      $(id)
        ?.addEventListener(
          "change",
          generateReport
        )
  );

  $("refreshMonthly")
    ?.addEventListener(
      "click",
      renderMonthly
    );

  $("supportTeacherFilter")
    ?.addEventListener(
      "change",
      renderSupport
    );

  $("supportStatusFilter")
    ?.addEventListener(
      "change",
      renderSupport
    );

  $("visitForm")
    ?.addEventListener(
      "submit",
      saveVisit
    );

  $("generateReport")
    ?.addEventListener(
      "click",
      generateReport
    );

  $("generateNarrative")
    ?.addEventListener(
      "click",
      generateNarrative
    );

  $("printReport")
    ?.addEventListener(
      "click",
      () => {
        if (
          !$("reportOutput")
            ?.innerHTML
            .trim()
        ) {
          alert(
            "أنشئي التقرير أولًا."
          );

          return;
        }

        window.print();
      }
    );

  document
    .querySelectorAll(
      'input[name="mainReportMode"]'
    )
    .forEach(
      radio =>
        radio.addEventListener(
          "change",
          () => {
            $("reportMonthWrap")
              ?.classList
              .toggle(
                "hidden",
                selectedReportMode() ===
                "overall"
              );

            generateReport();
          }
        )
    );

  $("reportMonth")
    ?.addEventListener(
      "change",
      generateReport
    );

  $("teacherForm")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const name =
          $("newTeacherName")
            ?.value
            .trim();
        const departmentId = num($("newTeacherDept")?.value);

        if (!name || !departmentId) {
          $("teacherMsg").textContent = "يرجى إدخال اسم المعلمة واختيار القسم.";
          return;
        }

        const {
          error
        } =
          await sb
            .from(
              "teachers"
            )
            .insert(
              {
                full_name:
                  name,

                department_id:
                  departmentId,

                active:
                  true
              }
            );

        if (
          error
        ) {
          $("teacherMsg").textContent =
            error.message;

          return;
        }

        $("newTeacherName").value =
          "";
        if ($("newTeacherDept")) $("newTeacherDept").value = "";

        await loadAll();

        fillUI();

        renderAll();

        $("teacherMsg").textContent =
          "تمت إضافة المعلمة.";
      }
    );

  $("deptForm")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const name =
          $("newDeptName")
            ?.value
            .trim();

        if (!name) {
          return;
        }

        const {
          error
        } =
          await sb
            .from(
              "departments"
            )
            .insert(
              {
                name,
                active:
                  true
              }
            );

        if (
          error
        ) {
          $("deptMsg").textContent =
            error.message;

          return;
        }

        $("newDeptName").value =
          "";

        await loadAll();

        fillUI();

        renderAll();

        $("deptMsg").textContent =
          "تمت إضافة القسم.";
      }
    );

  $("subjectForm")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const department_id =
          num(
            $("newSubjectDept")
              ?.value
          );

        const name =
          $("newSubjectName")
            ?.value
            .trim();

        if (
          !department_id ||
          !name
        ) {
          return;
        }

        const {
          error
        } =
          await sb
            .from(
              "subjects"
            )
            .insert(
              {
                department_id,
                name,
                active:
                  true
              }
            );

        if (
          error
        ) {
          const duplicate = String(error.code || "") === "23505" ||
            /duplicate key|unique constraint/i.test(String(error.message || ""));
          $("subjectMsg").textContent = duplicate
            ? "هذه المادة موجودة بالفعل في هذا القسم، ولا تحتاج إلى إضافتها مرة أخرى."
            : error.message;

          return;
        }

        $("newSubjectName").value =
          "";

        await loadAll();

        fillUI();

        renderAll();

        $("subjectMsg").textContent =
          "تمت إضافة المادة.";
      }
    );

  $("logoutBtn")
    ?.addEventListener(
      "click",
      async () => {
        await sb.auth.signOut();

        location.href =
          "index.html";
      }
    );
}

/* =========================================================
   BOOT ERROR
========================================================= */

function showBootError(
  error
) {
  console.error(
    error
  );

  document.body.innerHTML =
    `
      <main
        style="
          max-width:760px;
          margin:70px auto;
          padding:30px;
          font-family:Tahoma,Arial;
          direction:rtl;
        "
      >

        <div
          style="
            background:white;
            border-radius:18px;
            padding:30px;
            box-shadow:0 18px 50px rgba(0,0,0,.08);
          "
        >

          <h2
            style="
              color:#a32f29;
            "
          >
            تعذر تشغيل المنصة
          </h2>

          <p>
            ${esc(
              error?.message ||
              "حدث خطأ أثناء التشغيل."
            )}
          </p>

          <button
            onclick="location.reload()"
          >
            إعادة المحاولة
          </button>

        </div>

      </main>
    `;
}


/* =========================================================
   V5 LEADERSHIP INTELLIGENCE SUITE
   إضافة آمنة فوق وظائف النسخة الأصلية
========================================================= */
function v5MonthLabel(key){
  if(!key) return "كل الأشهر";
  const [y,m]=String(key).split("-");
  return `${monthNames[m] || m} ${y}`;
}
function v5TeacherName(id){ return maps().teachers[String(id)]?.full_name || `معلمة ${id}`; }
function v5DeptName(id){ return maps().departments[String(id)]?.name || "غير محدد"; }
function v5Profile(id){ return profiles.find(p=>String(p.id)===String(id)); }
function v5ObserverName(id){ const p=v5Profile(id); return p?.full_name || p?.email || "غير محدد"; }
function v5LeadershipProfiles(){ return profiles.filter(p=>["قيادة عليا","قيادة وسطى"].includes(leadershipLevel(p))); }
function v5FillSelect(id, rows, placeholder, valueFn, labelFn){
  const el=$(id); if(!el) return; const old=el.value;
  el.innerHTML=`<option value="">${esc(placeholder)}</option>`+rows.map(r=>`<option value="${esc(valueFn(r))}">${esc(labelFn(r))}</option>`).join("");
  if([...el.options].some(o=>o.value===old)) el.value=old;
}
function v5PrepareFilters(){
  const months=availableMonths();
  ["leadershipMonthFilter","followupMonthFilter","dept360MonthFilter"].forEach(id=>v5FillSelect(id,months,"كل الأشهر",x=>x,x=>v5MonthLabel(x)));
  ["leadershipDeptFilter","followupDeptFilter","dept360Filter"].forEach(id=>v5FillSelect(id,activeRows(departments),id==="dept360Filter"?"اختر القسم":"كل الأقسام",x=>x.id,x=>x.name));
  v5FillSelect("leadershipObserverFilter",v5LeadershipProfiles(),"اختر عضو القيادة",x=>x.id,x=>`${x.full_name || x.email} — ${leadershipLevel(x)}`);
}
/* الزيارة الفعلية: نفس المعلمة + التاريخ + الحصة + الصف + المادة/عنوان الدرس.
   إضافة المادة وعنوان الدرس تمنع دمج زيارتين حقيقيتين مختلفتين في اليوم نفسه. */
function v5VisitKey(v){
  return [
    v.teacher_id,
    v.visit_date,
    v.period_name||"",
    v.grade_section||"",
    v.subject_id||"",
    String(v.lesson_title||"").trim()
  ].join("|");
}
function v5VisitGroups(rows){
  const groups={};
  rows.forEach(v=>(groups[v5VisitKey(v)] ||= []).push(v));
  return Object.values(groups);
}
function v5ApprovedVisits(rows){
  return v5VisitGroups(rows).map(g=>{
    if(g.length===1) return {...g[0],_shared:false,_members:g};
    const senior=g.find(v=>leadershipLevel(v5Profile(v.observer_id))==="قيادة عليا");
    return {...(senior||g[0]),_shared:true,_members:g};
  });
}
/* تتبع عضو قيادة بعينه: نكتشف الزيارة المشتركة من جميع سجلات النطاق أولًا،
   ثم نختار المجموعات التي كان العضو جزءًا منها. ويُعرض حكم العضو نفسه في تقريره الشخصي،
   بينما يظل الحكم المعتمد للتحليل الرسمي هو حكم القيادة العليا. */
function v5VisitsForObserver(rows, observerId){
  return v5VisitGroups(rows)
    .filter(g=>g.some(v=>String(v.observer_id)===String(observerId)))
    .map(g=>{
      const own=g.find(v=>String(v.observer_id)===String(observerId));
      return {...own,_shared:g.length>1,_members:g};
    });
}
function v5CriteriaForVisit(visitId){ return ratings.filter(r=>String(r.visit_id)===String(visitId)); }
function v5TeacherDiagnosis(rows, teacherId){
  const tv=v5ApprovedVisits(rows.filter(v=>String(v.teacher_id)===String(teacherId))).sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date)));
  if(!tv.length) return {key:"unvisited",label:"لم تتم الزيارة",reason:"لا توجد زيارة معتمدة في النطاق",score:0,partial:[],repeat:[]};
  const partial=[]; const count={};
  tv.forEach(v=>v5CriteriaForVisit(v.id).filter(r=>num(r.rating)===1).forEach(r=>{const c=String(r.criterion_no); partial.push(c); count[c]=(count[c]||0)+1;}));
  const repeat=Object.entries(count).filter(([,n])=>n>=2).map(([c])=>c);
  const distinct=[...new Set(partial)];
  if(tv.length===1) return {key:"initial",label:"قراءة أولية",reason:distinct.length?`زيارة واحدة؛ ظهر جزئي في م${distinct.join("، م")}`:"زيارة واحدة فقط؛ يلزم رصد مستقل آخر",score:1,partial:distinct,repeat};
  if(repeat.length) return {key:"priority",label:"أولى بالرعاية",reason:`تكرر التقييم الجزئي في م${repeat.join("، م")} عبر زيارات مستقلة`,score:4,partial:distinct,repeat};
  if(distinct.length>=2) return {key:"targeted",label:"دعم مستهدف",reason:`ظهرت مؤشرات جزئية في ${distinct.length} معايير: م${distinct.join("، م")}`,score:3,partial:distinct,repeat};
  if(distinct.length===1) return {key:"verify",label:"متابعة للتحقق",reason:`ظهر جزئي في م${distinct[0]} دون تكرار مستقل حتى الآن`,score:2,partial:distinct,repeat};
  return {key:"stable",label:"مستقرة في الرصد المتاح",reason:"لا توجد مؤشرات جزئية في الزيارات المعتمدة ضمن النطاق",score:0,partial:[],repeat:[]};
}
function v5Badge(d){ const cls={priority:"danger",targeted:"warning",verify:"info",initial:"muted",stable:"success",unvisited:"muted"}[d.key]||"muted"; return `<span class="v5-badge ${cls}">${esc(d.label)}</span>`; }
function v5RowsForScope(month,dept){ return visits.filter(v=>(!month||monthKey(v.visit_date)===month)&&(!dept||String(v.department_id)===String(dept))); }
function renderLeadershipTracking(){
  v5PrepareFilters(); const out=$("leadershipTrackingOutput"); if(!out)return;
  const observer=$("leadershipObserverFilter")?.value||""; const month=$("leadershipMonthFilter")?.value||availableMonths()[0]||""; const dept=$("leadershipDeptFilter")?.value||"";
  if($("leadershipMonthFilter")&&!$("leadershipMonthFilter").value&&month) $("leadershipMonthFilter").value=month;
  if(!observer){ out.innerHTML=`<article class="panel"><div class="empty-state">اختاري عضو القيادة لعرض سجل التغطية بالتفصيل.</div></article>`; return; }
  const scopeTeachers=activeRows(teachers).filter(t=>!dept||String(t.department_id)===String(dept));
  const approved=v6LeadershipSubjectRows(observer,month,dept);
  const visitedIds=new Set(approved.map(v=>String(v.teacher_id))); const notVisited=scopeTeachers.filter(t=>!visitedIds.has(String(t.id)));
  const p=v5Profile(observer);
  const teacherRows=[...visitedIds].map(id=>{ const t=scopeTeachers.find(x=>String(x.id)===id)||teachers.find(x=>String(x.id)===id); const vs=approved.filter(v=>String(v.teacher_id)===id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date))); const last=vs[0]; const configured=t?v6ConfiguredSubjects(t):[]; const covered=[...new Set(vs.map(v=>v6VisitSubject(v)).filter(x=>configured.includes(x)))]; const missing=configured.filter(x=>!covered.includes(x)); const special=t&&v6TeacherCoverageMode(t)==="teacher_only"; return `<tr><td>${esc(v5TeacherName(id))}</td><td>${esc(v5DeptName(last.department_id))}</td><td>${vs.map(v=>`${esc(formatDate(v.visit_date))} — <strong>${esc(v6VisitSubject(v)||"غير محدد")}</strong> — ${esc(ratingLabel(v.overall_rating))}${v._shared?" — 👥 مشتركة":""}`).join("<br>")}</td><td>${special?"لا يطبق":(covered.join("، ")||"—")}</td><td>${special?"متابعة بالمعلمة":(missing.join("، ")||"اكتملت المواد")}</td></tr>`; }).join("");
  const partialSubject=scopeTeachers.filter(t=>visitedIds.has(String(t.id)) && v6TeacherCoverageMode(t)==="subject_based" && v6ConfiguredSubjects(t).length).filter(t=>{const vs=approved.filter(v=>String(v.teacher_id)===String(t.id)); const covered=[...new Set(vs.map(v=>v6VisitSubject(v)))]; return v6ConfiguredSubjects(t).some(x=>!covered.includes(x));});
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تقرير متابعة زيارات ${esc(p?.full_name||p?.email||"")}</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")} • ${esc(leadershipLevel(p))}</p></div><div class="v5-kpis"><b>${approved.length}<small>زيارات فعلية</small></b><b>${visitedIds.size}<small>معلمات تمت زيارتهن</small></b><b>${notVisited.length}<small>لم تتم زيارتهن</small></b><b>${partialSubject.length}<small>زارتهن وبقيت مواد</small></b></div></div>
  <h4>تمت زيارتهن — مع المادة والحكم</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>تفاصيل الزيارة/المادة/الحكم</th><th>مواد غُطيت</th><th>المتبقي من المواد</th></tr></thead><tbody>${teacherRows||`<tr><td colspan="5">لا توجد زيارات في النطاق.</td></tr>`}</tbody></table></div>
  <h4>لم تتم زيارتهن في ${esc(v5MonthLabel(month))}</h4><div class="v5-chip-list">${notVisited.map(t=>`<span>${esc(t.full_name)} <small>— ${esc(v5DeptName(t.department_id))}</small></span>`).join("")||"<span>اكتملت تغطية المعلمات ضمن النطاق.</span>"}</div>
  <div class="analysis-note">يعرض التقرير الآن فرقًا واضحًا بين «زيارة المعلمة» و«تغطية موادها». التربية الخاصة (التوحد، صعوبات التعلم، الدمج) تبقى بنمط متابعة المعلمة فقط. الزيارة المشتركة تُعرض مرة واحدة، والتحليل الرسمي يعتمد القيادة العليا عند وجودها.</div></article>`;
}
function printCurrentLeadershipReport(){ window.print(); }
function renderFollowupCenter(){
  v5PrepareFilters(); const out=$("followupCenterOutput"); if(!out)return;
  const month=$("followupMonthFilter")?.value||availableMonths()[0]||""; const dept=$("followupDeptFilter")?.value||""; if($("followupMonthFilter")&&!$("followupMonthFilter").value&&month) $("followupMonthFilter").value=month;
  const rows=v5RowsForScope(month,dept); const candidates=activeRows(teachers).filter(t=>!dept||String(t.department_id)===String(dept)).map(t=>({t,d:v5TeacherDiagnosis(rows,t.id)})).filter(x=>x.d.key!=="stable").sort((a,b)=>b.d.score-a.d.score||a.t.full_name.localeCompare(b.t.full_name,"ar"));
  out.innerHTML=`<article class="panel v5-report"><h3>الحالات التي تحتاج إجراء — ${esc(v5MonthLabel(month))}</h3><div class="v5-kpis"><b>${candidates.filter(x=>x.d.key==="priority").length}<small>أولى بالرعاية</small></b><b>${candidates.filter(x=>x.d.key==="targeted").length}<small>دعم مستهدف</small></b><b>${candidates.filter(x=>x.d.key==="verify").length}<small>تحقق</small></b><b>${candidates.filter(x=>x.d.key==="initial").length}<small>قراءة أولية</small></b></div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الحالة</th><th>لماذا؟</th><th>القرار المقترح</th></tr></thead><tbody>${candidates.map(({t,d})=>`<tr><td>${esc(t.full_name)}</td><td>${esc(v5DeptName(t.department_id))}</td><td>${v5Badge(d)}</td><td>${esc(d.reason)}</td><td>${d.key==="priority"?"دعم مستهدف + إعادة رصد":d.key==="targeted"?"تدخل مهني موجه":d.key==="verify"?"زيارة مستقلة للتحقق":d.key==="initial"?"استكمال الرصد":"جدولة زيارة"}</td></tr>`).join("")||`<tr><td colspan="5">لا توجد حالات متابعة في النطاق.</td></tr>`}</tbody></table></div><div class="analysis-note">التصنيف تشخيصي لاتخاذ قرار المتابعة، ولا يساوي حكمًا وظيفيًا على المعلمة. تكرار المؤشر في زيارات مستقلة يرفع أولوية المتابعة.</div></article>`;
}
function renderDepartment360(){
  v5PrepareFilters(); const out=$("department360Output"); if(!out)return;
  const dept=$("dept360Filter")?.value||""; const month=$("dept360MonthFilter")?.value||availableMonths()[0]||""; if($("dept360MonthFilter")&&!$("dept360MonthFilter").value&&month) $("dept360MonthFilter").value=month;
  if(!dept){ out.innerHTML=`<article class="panel"><div class="empty-state">اختاري القسم لعرض تحليل 360°.</div></article>`; return; }
  const ts=activeRows(teachers).filter(t=>String(t.department_id)===String(dept)); const rows=v5RowsForScope(month,dept); const approved=v5ApprovedVisits(rows); const visited=new Set(approved.map(v=>String(v.teacher_id)));
  const diag=ts.map(t=>({t,d:v5TeacherDiagnosis(rows,t.id),n:approved.filter(v=>String(v.teacher_id)===String(t.id)).length}));
  const crit={}; approved.forEach(v=>v5CriteriaForVisit(v.id).forEach(r=>{const c=String(r.criterion_no); (crit[c]||={total:0,partial:0,high:0}); crit[c].total++; if(num(r.rating)===1)crit[c].partial++; if(num(r.rating)>=3)crit[c].high++;}));
  const priorities=Object.entries(crit).sort((a,b)=>pct(b[1].partial,b[1].total)-pct(a[1].partial,a[1].total)).slice(0,5);
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(v5DeptName(dept))} — تحليل 360°</h3><p>${esc(v5MonthLabel(month))}</p></div><div class="v5-kpis"><b>${ts.length}<small>معلمات القسم</small></b><b>${visited.size}<small>تمت زيارتهن</small></b><b>${approved.length}<small>زيارات معتمدة</small></b><b>${pct(visited.size,ts.length)}%<small>تغطية القسم</small></b></div></div><h4>المعلمات وقراءة المتابعة</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>زيارات</th><th>الحالة</th><th>المعايير الجزئية</th><th>القراءة</th></tr></thead><tbody>${diag.map(({t,d,n})=>`<tr><td>${esc(t.full_name)}</td><td>${n}</td><td>${v5Badge(d)}</td><td>${d.partial.length?`م${d.partial.join("، م")}`:"—"}</td><td>${esc(d.reason)}</td></tr>`).join("")}</tbody></table></div><h4>أعلى أولويات المعايير داخل القسم</h4><div class="v5-priority-grid">${priorities.map(([c,x])=>`<div><strong>م${c}</strong><b>${pct(x.partial,x.total)}%</b><small>يفي جزئيًا • ${x.partial}/${x.total} رصدًا</small></div>`).join("")||"لا توجد بيانات معايير كافية"}</div><div class="analysis-note">قراءة القسم تجمع التغطية والمعلمات والمعايير في صفحة واحدة. أي نسبة تعتمد على الرصد المتاح في الشهر المحدد ولا تُعمم خارج نطاقه.</div></article>`;
}


/* =========================================================
   V6 SUBJECT COVERAGE & MATERIAL INTELLIGENCE
   تغطية المعلمة × المادة + تحليل المادة عبر الأقسام
========================================================= */
function v6Norm(x){
  return String(x||"").trim().toLowerCase()
    .replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي")
    .replace(/[ًٌٍَُِّْـ]/g,"").replace(/\s+/g," ");
}
function v6IsSpecialDeptName(name){
  const n=v6Norm(name);
  return n.includes("التوحد") || n.includes("صعوبات التعلم") || n.includes("الدمج") || n.includes("النطق");
}
function v6TeacherCoverageMode(t){
  return v6IsSpecialDeptName(v5DeptName(t.department_id)) ? "teacher_only" : "subject_based";
}
const V6_VERIFIED_SUBJECT_MAP = [
  {keys:["حنان"], subjects:["العربي","التربية الإسلامية","العلوم","الرياضيات"]},
  {keys:["مها بسيوني"], subjects:["العربي","التربية الإسلامية","العلوم","الرياضيات"]},
  {keys:["هيفاء"], subjects:["العربي","التربية الإسلامية","العلوم","الرياضيات"]},
  {keys:["دانه جمال","دانة جمال"], subjects:["العربي","التربية الإسلامية","العلوم","الرياضيات"]},
  {keys:["شريفه الرويعي","شريفة الرويعي"], subjects:["العربي","التربية الإسلامية","العلوم","الرياضيات"]},
  {keys:["ختام"], subjects:["العربي","التربية الإسلامية","العلوم","الرياضيات"]},
  {keys:["فاطمه المطر","فاطمة المطر"], subjects:["العربي","التربية الإسلامية","العلوم","الرياضيات"]},
  {keys:["نجود"], subjects:["الرياضيات","العلوم"]},
  {keys:["لطيفه","لطيفة"], subjects:["التلاوة"]},
  {keys:["نوره يحي","نورة يحي"], subjects:["التلاوة"]},
  {keys:["امال","آمال"], subjects:["الفن"]},
  {keys:["مني الحلو","منى الحلو"], subjects:["الفن"]},
  {keys:["مشاعل"], subjects:["التقانة"]},
  {keys:["مروه محمد صالح","مروة محمد صالح"], subjects:["التقانة"]},
  {keys:["مروه الحسيني","مروة الحسيني"], subjects:["الحاسوب"]},
  {keys:["نوال المراغي"], subjects:["الحاسوب"]},
  {keys:["فاطمه الرويعي","فاطمة الرويعي"], subjects:["الأسرية"]},
  {keys:["فاطمه البشير","فاطمة البشير"], subjects:["الأسرية","المواطنة"]},
  {keys:["نوال الحربي"], subjects:["المواطنة"]},
  {keys:["عبير الطيري"], subjects:["الاجتماعيات","المواطنة"]},
  {keys:["اروي","أروى"], subjects:["الرياضيات"]},
  {keys:["نوره سعيد","نورة سعيد"], subjects:["الرياضيات"]},
  {keys:["جوري"], subjects:["العلوم"]},
  {keys:["فاطمه الحامد","فاطمة الحامد"], subjects:["العربي","التربية الإسلامية"]},
  {keys:["عاليه","عالية"], subjects:["العربي","التربية الإسلامية"]},
  {keys:["الاء","آلاء"], subjects:["العربي","التربية الإسلامية"]},
  {keys:["امانه","أمانة"], subjects:["الإنجليزي"]},
  {keys:["شوق"], subjects:["الإنجليزي"]},
  {keys:["هبه","هبة"], subjects:["الإنجليزي"]}
];
function v6CanonicalSubjectName(name){
  const n=v6Norm(name);
  const rules=[
    ["التربيه الاسلاميه","التربية الإسلامية"],["اسلاميه","التربية الإسلامية"],["دين","التربية الإسلامية"],
    ["اللغه العربيه","العربي"],["عربي","العربي"],
    ["اللغه الانجليزيه","الإنجليزي"],["انجليزي","الإنجليزي"],
    ["رياضيات","الرياضيات"],["علوم","العلوم"],["تلاوه","التلاوة"],
    ["فنون","الفن"],["فن","الفن"],["تقانه","التقانة"],["حاسوب","الحاسوب"],
    ["اسريه","الأسرية"],["مواطنه","المواطنة"],["اجتماعيات","الاجتماعيات"]
  ];
  for(const [k,v] of rules) if(n.includes(k)) return v;
  return String(name||"").trim() || "غير محدد";
}
// Verified subject catalogue from the production database (SQL audit 2026-10-10).
// The REST endpoint for public.subjects is currently unavailable to the local app (404),
// so IDs seen in visits must still resolve correctly without inventing a subject.
const V14_VERIFIED_SUBJECT_ID_MAP = Object.freeze({
  "1":"اللغة العربية",
  "2":"التربية الإسلامية",
  "3":"الرياضيات",
  "4":"العلوم",
  "6":"المواطنة",
  "7":"اللغة العربية",
  "9":"الرياضيات",
  "10":"العلوم",
  "12":"اللغة الإنجليزية",
  "13":"الحاسوب",
  "14":"التقانة",
  "15":"الفن",
  "17":"التربية الرياضية",
  "18":"العربي",
  "22":"العربي",
  "26":"العربي",
  "27":"الإنجليزي",
  "28":"الرياضيات",
  "32":"الرياضيات"
});
function buildVerifiedSubjectRows(sourceVisits = []){
  return Object.entries(V14_VERIFIED_SUBJECT_ID_MAP).map(([id,name])=>{
    const seen = sourceVisits.find(v=>String(v.subject_id)===String(id) && v.department_id);
    return {
      id:String(id),
      name:v6CanonicalSubjectName(name),
      department_id:seen?.department_id || null,
      active:true
    };
  });
}

function v6SubjectNameById(id){
  if(id===null || id===undefined || String(id).trim()==="") return "غير محدد";
  const fromLoaded = subjects.find(s=>String(s.id)===String(id));
  const raw = fromLoaded?.name || fromLoaded?.subject_name || V14_VERIFIED_SUBJECT_ID_MAP[String(id)] || "";
  return raw ? v6CanonicalSubjectName(raw) : "غير محدد";
}
function v6ConfiguredSubjects(t){
  if(v6TeacherCoverageMode(t)==="teacher_only") return [];
  const dbRows=teacherSubjects.filter(x=>String(x.teacher_id)===String(t.id) && x.active!==false);
  if(dbRows.length){
    const names=dbRows.map(x=>v6SubjectNameById(x.subject_id)).filter(Boolean);
    return [...new Set(names)];
  }
  const name=v6Norm(t.full_name);
  // Match verified teacher aliases by significant name tokens, not only contiguous text.
  // This supports full DB names such as "فاطمة علي أحمد الحامد" for alias "فاطمة الحامد".
  const aliasMatches=(full,alias)=>{
    const ft=new Set(v6Norm(full).split(" ").filter(Boolean));
    const at=v6Norm(alias).split(" ").filter(Boolean);
    return at.length>0 && at.every(tok=>ft.has(tok));
  };
  const match=V6_VERIFIED_SUBJECT_MAP.find(row=>row.keys.some(k=>aliasMatches(name,k)));
  if(match) return match.subjects.slice();
  // Safe fallback for single-subject teachers: infer only when visits consistently show one subject.
  const seen=[...new Set(visits.filter(v=>String(v.teacher_id)===String(t.id) && v.subject_id).map(v=>v6SubjectNameById(v.subject_id)).filter(Boolean))];
  return seen.length===1 ? seen : [];
}
function v6VisitSubject(v){ return v6SubjectNameById(v.subject_id); }
function v6TeacherSubjectCoverage(t, rows){
  const configured=v6ConfiguredSubjects(t);
  if(v6TeacherCoverageMode(t)==="teacher_only"){
    const n=v5ApprovedVisits(rows.filter(v=>String(v.teacher_id)===String(t.id))).length;
    return {mode:"teacher_only",configured:[],covered:[],missing:[],visitCount:n,status:n?"visited":"unvisited"};
  }
  const approved=v5ApprovedVisits(rows.filter(v=>String(v.teacher_id)===String(t.id)));
  const covered=[...new Set(approved.map(v=>v6VisitSubject(v)).filter(x=>configured.includes(x)))];
  const missing=configured.filter(x=>!covered.includes(x));
  return {mode:"subject_based",configured,covered,missing,visitCount:approved.length,status:!approved.length?"unvisited":missing.length?"partial":"complete"};
}
function v6CoverageBadge(c){
  if(c.mode==="teacher_only") return c.status==="visited"?'<span class="v5-badge success">تمت الزيارة</span>':'<span class="v5-badge muted">لم تتم الزيارة</span>';
  if(c.status==="complete") return '<span class="v5-badge success">مكتملة المواد</span>';
  if(c.status==="partial") return '<span class="v5-badge warning">تغطية مواد جزئية</span>';
  return '<span class="v5-badge muted">لم تتم الزيارة</span>';
}
function v6SubjectStats(rows, subjectName){
  const r=v5ApprovedVisits(rows).filter(v=>v6VisitSubject(v)===subjectName);
  const tids=new Set(r.map(v=>String(v.teacher_id)));
  const crit={};
  r.forEach(v=>v5CriteriaForVisit(v.id).forEach(x=>{const c=String(x.criterion_no); (crit[c]||={total:0,partial:0,high:0}); crit[c].total++; if(num(x.rating)===1)crit[c].partial++; if(num(x.rating)>=3)crit[c].high++;}));
  const priority=Object.entries(crit).sort((a,b)=>pct(b[1].partial,b[1].total)-pct(a[1].partial,a[1].total)).slice(0,5);
  return {rows:r,teachers:tids,crit,priority};
}
function v6AllConfiguredSubjects(ts){ return [...new Set(ts.flatMap(t=>v6ConfiguredSubjects(t)))].sort((a,b)=>a.localeCompare(b,"ar")); }
function renderSubjectCoverage(){
  const out=$("subjectCoverageOutput"); if(!out) return;
  v6PrepareSubjectFilters();
  const month=$("subjectCoverageMonth")?.value || availableMonths()[0] || "";
  const dept=$("subjectCoverageDept")?.value || "";
  const chosen=$("subjectCoverageSubject")?.value || "";
  if($("subjectCoverageMonth")&&!$("subjectCoverageMonth").value&&month) $("subjectCoverageMonth").value=month;
  const ts=activeRows(teachers).filter(t=>!dept||String(t.department_id)===String(dept));
  const rows=v5RowsForScope(month,dept);
  const coverage=ts.map(t=>({t,c:v6TeacherSubjectCoverage(t,rows)}));
  const subjectBased=coverage.filter(x=>x.c.mode==="subject_based" && x.c.configured.length);
  const special=coverage.filter(x=>x.c.mode==="teacher_only");
  const slots=subjectBased.reduce((n,x)=>n+x.c.configured.length,0);
  const coveredSlots=subjectBased.reduce((n,x)=>n+x.c.covered.length,0);
  const teacherVisited=coverage.filter(x=>x.c.visitCount>0).length;
  const allSubjects=v6AllConfiguredSubjects(ts);
  const subject=chosen || allSubjects[0] || "";
  if($("subjectCoverageSubject") && !$("subjectCoverageSubject").value && subject) $("subjectCoverageSubject").value=subject;
  const ss=subject?v6SubjectStats(rows,subject):{rows:[],teachers:new Set(),priority:[]};
  const targetTeachers=ts.filter(t=>v6ConfiguredSubjects(t).includes(subject));
  const subjectCoverage=pct(targetTeachers.filter(t=>ss.teachers.has(String(t.id))).length,targetTeachers.length);
  out.innerHTML=`<article class="panel v5-report">
    <div class="v5-report-head"><div><h3>تحليل المواد والتغطية</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p></div>
    <div class="v5-kpis"><b>${pct(teacherVisited,ts.length)}%<small>تغطية المعلمات</small></b><b>${pct(coveredSlots,slots)}%<small>تغطية المواد المستهدفة</small></b><b>${coveredSlots}/${slots}<small>معلمة × مادة مغطاة</small></b><b>${special.length}<small>تربية خاصة بنمط مستقل</small></b></div></div>
    <div class="analysis-note">تغطية المعلمة لا تعني تلقائيًا تغطية كل موادها. المواد تُقاس على مستوى الفصل الدراسي/النطاق المحدد، بينما التوحد وصعوبات التعلم والدمج تُتابع بالمعلمة والزيارة فقط.</div>
    <h4>مصفوفة تغطية المعلمة × المادة</h4>
    <div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الحالة</th><th>تمت تغطيته</th><th>المتبقي</th><th>الزيارات</th></tr></thead><tbody>
    ${coverage.map(({t,c})=>`<tr><td>${esc(t.full_name)}</td><td>${esc(v5DeptName(t.department_id))}</td><td>${v6CoverageBadge(c)}</td><td>${c.mode==="teacher_only"?(c.visitCount?"زيارة المعلمة مكتملة":"—"):(c.covered.map(x=>`✓ ${esc(x)}`).join("<br>")||"—")}</td><td>${c.mode==="teacher_only"?"لا يطبق تحليل المواد":(c.missing.map(x=>`◷ ${esc(x)}`).join("<br>")||"لا يوجد")}</td><td>${c.visitCount}</td></tr>`).join("")}
    </tbody></table></div>
    <h4>تحليل مادة: ${esc(subject||"—")}</h4>
    <div class="v5-kpis"><b>${targetTeachers.length}<small>معلمات يدرسن المادة</small></b><b>${ss.teachers.size}<small>تم رصدهن في المادة</small></b><b>${ss.rows.length}<small>زيارات المادة</small></b><b>${subjectCoverage}%<small>تغطية المادة</small></b></div>
    <div class="v5-priority-grid">${ss.priority.map(([c,x])=>`<div><strong>م${c}</strong><b>${pct(x.partial,x.total)}%</b><small>يفي جزئيًا • ${x.partial}/${x.total} رصدًا</small></div>`).join("")||"لا توجد بيانات معايير كافية لهذه المادة"}</div>
    <div class="analysis-note">تحليل المادة يجمع زيارات المادة عبر الأقسام، لكنه يعرض حجم الرصد صراحةً حتى لا تتحول الفروق الناتجة عن قلة الزيارات إلى مقارنة أداء مضللة.</div>
  </article>`;
}
function v6PrepareSubjectFilters(){
  v5FillSelect("subjectCoverageMonth",availableMonths(),"كل الأشهر",x=>x,x=>v5MonthLabel(x));
  v5FillSelect("subjectCoverageDept",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name);
  const dept=$("subjectCoverageDept")?.value||"";
  const ts=activeRows(teachers).filter(t=>!dept||String(t.department_id)===String(dept));
  v5FillSelect("subjectCoverageSubject",v6AllConfiguredSubjects(ts),"اختر المادة",x=>x,x=>x);
}
function v6LeadershipSubjectRows(observer,month,dept){
  const scopeRows=v5RowsForScope(month,dept);
  return v5VisitsForObserver(scopeRows,observer);
}


/* =========================================================
   V4 — INTEGRATED SAFE LEADERSHIP ANALYTICS
   Additive layer: preserves original data entry, dashboards,
   support, impact, forms and reporting; overrides report engine only.
========================================================= */

function v4AnalysisSource(){ return $("reportLeadershipSource")?.value || "official"; }
function v4VisitLevel(v){ return leadershipLevel(evaluatorForVisit(v)); }
function v4SharedKey(v){
  return [v.teacher_id||"",v.visit_date||"",v.period_name||"",v.grade_section||"",v.subject_id||"",v.lesson_title||""].map(String).join("||");
}
function v4AcceptedVisits(rows, source=v4AnalysisSource()){
  const allowed = rows.filter(v=>["قيادة عليا","قيادة وسطى"].includes(v4VisitLevel(v)));
  if(source==="upper") return allowed.filter(v=>v4VisitLevel(v)==="قيادة عليا");
  if(source==="middle") return allowed.filter(v=>v4VisitLevel(v)==="قيادة وسطى");
  if(source==="all") return allowed;
  const groups=new Map();
  allowed.forEach(v=>{ const k=v4SharedKey(v); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(v); });
  return [...groups.values()].map(g=>g.find(v=>v4VisitLevel(v)==="قيادة عليا") || g[0]);
}
function v4ScopeRawRows(){
  const mode=selectedReportMode();
  const departmentId=$("reportDeptFilter")?.value||"";
  const teacherId=$("reportTeacherFilter")?.value||"";
  if(mode==="overall") return filterVisitsByScope(visits,{departmentId,teacherId,fromMonth:$("reportFromMonth")?.value||"",toMonth:$("reportToMonth")?.value||""});
  const month=$("reportMonth")?.value||availableMonths()[0]||"";
  return filterVisitsByScope(visits,{departmentId,teacherId,fromMonth:month,toMonth:month});
}
function reportRows(){ return v4AcceptedVisits(v4ScopeRawRows()); }
function v4TeacherName(id){ return maps().teachers[String(id)]?.full_name || "معلمة غير محددة"; }
function v4DeptName(id){ return maps().departments[String(id)]?.name || "قسم غير محدد"; }
function v4CriterionName(id){ return criteria.find(c=>num(c.id)===num(id))?.criterion_text || `المعيار م${id}`; }
function v4RatingsForVisitIds(ids){ const s=new Set(ids.map(String)); return ratings.filter(r=>s.has(String(r.visit_id))); }

function v4TeacherDiagnostic(rows, teacherId){
  const tv=rows.filter(v=>String(v.teacher_id)===String(teacherId)).slice().sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date)));
  const rr=v4RatingsForVisitIds(tv.map(v=>v.id));
  const partial=rr.filter(r=>num(r.rating)===1);
  const byCriterion={}; partial.forEach(r=>{ const k=num(r.criterion_no); (byCriterion[k] ||= new Set()).add(String(r.visit_id)); });
  const repeated=Object.entries(byCriterion).filter(([,set])=>set.size>=2).map(([k])=>num(k));
  const distinct=Object.keys(byCriterion).map(num);
  const partialVisits=new Set(partial.map(r=>String(r.visit_id))).size;
  const last=tv[tv.length-1];
  const previous=tv[tv.length-2];
  let status="مستقرة في الرصد المتاح", priority="low", reason="لم يظهر تقييم جزئي في الزيارات المعتمدة ضمن النطاق.";
  if(tv.length===1){ status="قراءة أولية"; priority="medium"; reason="زيارة معتمدة واحدة فقط؛ يلزم رصد إضافي قبل إصدار اتجاه."; }
  if(partial.length>0 && tv.length>=1){ status="متابعة للتحقق"; priority="medium"; reason=`ظهر تقييم جزئي في ${distinct.length} معيار/معايير خلال ${partialVisits} زيارة/زيارات.`; }
  if(tv.length>=2 && (partialVisits>=2 || distinct.length>=2) && repeated.length===0){ status="دعم مستهدف"; priority="medium"; reason=`توزعت مؤشرات جزئية على ${distinct.length} معيار/معايير أو أكثر من زيارة، دون تكرار نفس المعيار مرتين بعد.`; }
  if(tv.length>=2 && repeated.length){ status="أولى بالرعاية"; priority="high"; reason=`تكرر التقييم الجزئي في ${repeated.map(x=>`م${x}`).join("، ")} عبر زيارتين مستقلتين أو أكثر.`; }
  const latestOverall=num(last?.overall_rating); const prevOverall=num(previous?.overall_rating);
  let trend="—"; if(tv.length>=2 && latestOverall && prevOverall) trend=latestOverall>prevOverall?"تحسن":""+(latestOverall<prevOverall?"تراجع":"ثبات");
  const score=repeated.length*5 + partialVisits*2 + distinct.length + (status==="أولى بالرعاية"?5:0);
  return {teacherId:String(teacherId),name:v4TeacherName(teacherId),departmentId:String(last?.department_id||tv[0]?.department_id||""),department:v4DeptName(last?.department_id||tv[0]?.department_id),visits:tv.length,partialCount:partial.length,partialVisits,distinct,repeated,status,priority,reason,trend,score};
}
function v4TeacherDiagnostics(rows){
  return [...new Set(rows.map(v=>String(v.teacher_id)).filter(Boolean))].map(id=>v4TeacherDiagnostic(rows,id)).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name,"ar"));
}
function v4SourceLabel(){ return ({official:"التحليل الرسمي المعتمد: العليا + الوسطى مع دمج الزيارة المشتركة واعتماد العليا",upper:"القيادة العليا فقط",middle:"القيادة الوسطى فقط",all:"العليا + الوسطى — جميع السجلات دون دمج"})[v4AnalysisSource()] || "التحليل الرسمي المعتمد"; }
function v4CriterionRows(rows){ return criterionStats(rows).filter(x=>x.count>0).sort((a,b)=>b.inappropriateRate-a.inappropriateRate || b.exceedsRate-a.exceedsRate); }
function v4StrengthRows(rows){ return criterionStats(rows).filter(x=>x.count>0).sort((a,b)=>b.exceedsRate-a.exceedsRate || a.inappropriateRate-b.inappropriateRate); }
function v4DeptDiagnostics(rows){
  const ds=[...new Set(rows.map(v=>String(v.department_id||"")).filter(Boolean))];
  return ds.map(id=>{ const dr=rows.filter(v=>String(v.department_id)===id); const td=v4TeacherDiagnostics(dr); return {id,name:v4DeptName(id),visits:dr.length,teachers:td.length,care:td.filter(x=>x.status==="أولى بالرعاية").length,targeted:td.filter(x=>x.status==="دعم مستهدف").length,verify:td.filter(x=>x.status==="متابعة للتحقق").length,initial:td.filter(x=>x.status==="قراءة أولية").length,top:v4CriterionRows(dr)[0]}; }).sort((a,b)=>(b.care+b.targeted)-(a.care+a.targeted)||b.visits-a.visits);
}
function v4Coverage(rows){
  const departmentId=$("reportDeptFilter")?.value||""; const teacherId=$("reportTeacherFilter")?.value||"";
  return teacherCoverage(rows,{departmentId,teacherId});
}
function v4LeadershipDetails(rows){
  const m=new Map(); rows.forEach(v=>{ const p=evaluatorForVisit(v); const key=String(p?.id||v.observer_id||"unknown"); if(!m.has(key))m.set(key,{name:p?.full_name||"غير محدد",level:v4VisitLevel(v),count:0}); m.get(key).count++; }); return [...m.values()].sort((a,b)=>b.count-a.count);
}
function v4PreviousMonthRows(){
  if(selectedReportMode()!=="monthly") return [];
  const selected=$("reportMonth")?.value||availableMonths()[0]||"";
  const departmentId=$("reportDeptFilter")?.value||""; const teacherId=$("reportTeacherFilter")?.value||"";
  const scoped=filterVisitsByScope(visits,{departmentId,teacherId}); const months=[...new Set(scoped.map(v=>monthKey(v.visit_date)).filter(Boolean))].sort(); const i=months.indexOf(selected); if(i<=0)return [];
  return v4AcceptedVisits(scoped.filter(v=>monthKey(v.visit_date)===months[i-1]));
}
function v4TrendSummary(rows){
  const prev=v4PreviousMonthRows(); if(!prev.length)return {available:false,text:"لا تتوافر فترة سابقة مكتملة للمقارنة؛ تُعامل الفترة الحالية كخط أساس."};
  const cur=v4CriterionRows(rows), old=v4CriterionRows(prev); let improved=0,declined=0,stable=0;
  cur.forEach(c=>{const o=old.find(x=>x.id===c.id); if(!o)return; const d=c.inappropriateRate-o.inappropriateRate; if(d<=-3)improved++; else if(d>=3)declined++; else stable++;});
  return {available:true,text:`مقارنة بالفترة السابقة: تحسن ${improved} معيارًا، تراجع ${declined}، واستقر ${stable} ضمن هامش ±2 نقطة مئوية.`};
}
function v4DecisionRows(rows){
  const gaps=v4CriterionRows(rows).slice(0,5); return gaps.map((g,i)=>({criterion:`م${g.id}`,name:g.criterion_text,rate:g.inappropriateRate,priority:i===0?"أولوية 1":i<3?"أولوية 2":"متابعة",action:g.inappropriateRate>=20?"دعم مهني موجه + إعادة رصد":"متابعة مستهدفة ونقل ممارسة ناجحة",success:"انخفاض نسبة «جزئي» وارتفاع «يفي تمامًا/يتجاوز» في الرصد اللاحق"}));
}
function v4EscList(arr){ return arr.length?arr.map(x=>`م${x}`).join("، "):"—"; }

function generateReport(){
  const box=$("reportOutput"); if(!box)return;
  const raw=v4ScopeRawRows(), rows=v4AcceptedVisits(raw), mode=selectedReportMode();
  const departmentId=$("reportDeptFilter")?.value||"", teacherId=$("reportTeacherFilter")?.value||"";
  const reportScope=scopeLabel(departmentId,teacherId); const period=mode==="overall"?APP_CONFIG.academicYear:monthLabel($("reportMonth")?.value||availableMonths()[0]||"");
  const leadership=leadershipVisitStats(rows), coverage=v4Coverage(rows), diag=v4TeacherDiagnostics(rows), dept=v4DeptDiagnostics(rows), gaps=v4CriterionRows(rows), strengths=v4StrengthRows(rows), leaders=v4LeadershipDetails(rows), trend=v4TrendSummary(rows), decisions=v4DecisionRows(rows);
  const internal=$("reportType")?.value==="internal";
  const initial=diag.filter(x=>x.status==="قراءة أولية").length, care=diag.filter(x=>x.status==="أولى بالرعاية").length, targeted=diag.filter(x=>x.status==="دعم مستهدف").length, verify=diag.filter(x=>x.status==="متابعة للتحقق").length;
  const sharedRemoved=Math.max(0,raw.filter(v=>["قيادة عليا","قيادة وسطى"].includes(v4VisitLevel(v))).length-rows.length);
  const topGap=gaps[0], topStrength=strengths[0];
  box.innerHTML=`<div class="official-report">
    <img src="${SCHOOL_HEADER_IMAGE}" style="max-width:100%;margin-bottom:18px" alt="الترويسة الرسمية">
    <h2>التقرير القيادي المتكامل للزيارات الصفية</h2><p><strong>${esc(period)}</strong> — ${esc(reportScope)}</p>
    <div class="report-section-note"><strong>منهجية الاعتماد:</strong> ${esc(v4SourceLabel())}. ${sharedRemoved?`تم استبعاد ${sharedRemoved} سجلًا مكررًا ناتجًا عن زيارات مشتركة من الحساب الرسمي.`:"لم ينتج عن قاعدة الدمج استبعاد سجلات ضمن النطاق الحالي."}</div>
    <h3>1. الملخص التنفيذي</h3>
    <p id="officialExecutiveSummary">اعتمد التحليل على <strong>${rows.length}</strong> زيارة فعلية/معتمدة شملت <strong>${diag.length}</strong> معلمة، وبلغت التغطية الرصدية <strong>${coverage.rate}%</strong>. نفذت القيادة العليا ${leadership.upper} زيارة والقيادة الوسطى ${leadership.middle}. ${topGap?`وتصدر م${topGap.id} أولويات التطوير بنسبة ${topGap.inappropriateRate}% في مستوى «يفي بالتوقعات جزئيًا».`:""} ${topStrength?`وفي المقابل برز م${topStrength.id} كأحد أقوى المؤشرات بنسبة ${topStrength.exceedsRate}% في «يتجاوز التوقعات فأعلى».`:""} ${trend.text}</p>
    <div class="leadership-report-grid"><div class="leadership-kpi"><strong>${rows.length}</strong><span>زيارات معتمدة</span></div><div class="leadership-kpi"><strong>${coverage.rate}%</strong><span>تغطية رصدية</span></div><div class="leadership-kpi"><strong>${care}</strong><span>أولى بالرعاية</span></div><div class="leadership-kpi"><strong>${initial}</strong><span>قراءة أولية</span></div></div>
    <h3>2. جودة البيانات وعمق الرصد</h3><p>من أصل ${diag.length} معلمة مرصودة، توجد ${initial} قراءة أولية، و${verify} حالة متابعة للتحقق، و${targeted} حالة دعم مستهدف، و${care} حالة أولى بالرعاية وفق تكرار المؤشرات الجزئية في زيارات مستقلة. القراءة الأولية لا تعني ضعف الأداء؛ بل عدم كفاية الرصد لتكوين اتجاه ثابت.</p>
    <h3>3. توزيع القيادة في الرصد</h3><table class="mini-table"><thead><tr><th>المقيم</th><th>المستوى</th><th>الزيارات المعتمدة</th></tr></thead><tbody>${leaders.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.level)}</td><td>${x.count}</td></tr>`).join("")}</tbody></table>
    <h3>4. التشخيص القيادي للأقسام</h3><table class="mini-table"><thead><tr><th>القسم</th><th>الزيارات</th><th>المعلمات</th><th>أولى بالرعاية</th><th>دعم مستهدف</th><th>متابعة للتحقق</th><th>قراءة أولية</th><th>أعلى أولوية معيارية</th></tr></thead><tbody>${dept.map(d=>`<tr><td>${esc(d.name)}</td><td>${d.visits}</td><td>${d.teachers}</td><td>${d.care}</td><td>${d.targeted}</td><td>${d.verify}</td><td>${d.initial}</td><td>${d.top?`م${d.top.id} — ${d.top.inappropriateRate}% جزئي`:"—"}</td></tr>`).join("")}</tbody></table>
    <h3>5. تحليل المعايير م1–م18</h3><table class="mini-table"><thead><tr><th>المعيار</th><th>يفي جزئيًا</th><th>يفي تمامًا</th><th>يتجاوز فأعلى</th><th>القراءة القيادية</th></tr></thead><tbody>${gaps.map(g=>`<tr><td><strong>م${g.id}</strong> — ${esc(g.criterion_text)}</td><td>${g.inappropriateRate}%</td><td>${pct(g.satisfactory,g.count)}%</td><td>${g.exceedsRate}%</td><td>${g.inappropriateRate>=20?"أولوية تطوير":g.inappropriateRate>=17?"متابعة/تباين":"قوة أو استقرار نسبي"}</td></tr>`).join("")}</tbody></table>
    <h3>6. جوانب القوة</h3>${strengths.slice(0,5).map(s=>`<div class="decision-card priority-low"><strong>م${s.id}</strong> — ${esc(s.criterion_text)}: ${s.exceedsRate}% يتجاوز التوقعات فأعلى، و${s.inappropriateRate}% جزئي.</div>`).join("")}
    <h3>7. أولويات التطوير</h3>${gaps.slice(0,5).map((g,i)=>`<div class="decision-card ${i<3?'priority-high':'priority-medium'}"><strong>${i+1}. م${g.id} — ${esc(g.criterion_text)}</strong><br>نسبة الجزئي: ${g.inappropriateRate}% | يتجاوز فأعلى: ${g.exceedsRate}%</div>`).join("")}
    <h3>8. من الرصد إلى القرار</h3><table class="mini-table"><thead><tr><th>المؤشر</th><th>الأولوية</th><th>التدخل</th><th>مؤشر النجاح</th></tr></thead><tbody>${decisions.map(d=>`<tr><td>${d.criterion} — ${esc(d.name)} (${d.rate}% جزئي)</td><td>${d.priority}</td><td>${d.action}</td><td>${d.success}</td></tr>`).join("")}</tbody></table>
    ${internal?`<div class="print-page-break"></div><h3>9. المعلمات المستهدفات بالمتابعة — نسخة داخلية</h3><p class="report-section-note">ظهور الاسم هنا لا يعني «ضعف المعلمة». التصنيف مبني على نمط المؤشرات داخل الزيارات المعتمدة، مع فصل القراءة الأولية والمتابعة للتحقق عن «الأولى بالرعاية».</p><table class="mini-table"><thead><tr><th>المعلمة</th><th>القسم</th><th>الزيارات</th><th>الحالة</th><th>المعايير الجزئية</th><th>المتكررة</th><th>الاتجاه</th><th>لماذا؟</th></tr></thead><tbody>${diag.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.department)}</td><td>${t.visits}</td><td><span class="status-chip">${t.status}</span></td><td>${v4EscList(t.distinct)}</td><td>${v4EscList(t.repeated)}</td><td>${t.trend}</td><td>${esc(t.reason)}</td></tr>`).join("")}</tbody></table>`:""}
    <h3>${internal?"10":"9"}. الاحتياجات المهنية المستخلصة</h3><p>تُوجه الاحتياجات المدرسية العامة إلى المعايير الأعلى تكرارًا في «جزئي»، بينما يخصص الدعم الفردي للحالات التي تكرر فيها المؤشر في زيارات مستقلة. ويُفضّل استثمار المعايير ذات الأداء القوي في الزيارات التبادلية والنمذجة بدل تقديم تدريب عام غير موجه.</p>
    <h3>${internal?"11":"10"}. خطة المتابعة للفترة التالية</h3><ul><li>استكمال الرصد للحالات ذات القراءة الأولية قبل إصدار حكم اتجاهي.</li><li>إعادة رصد معايير الأولوية ${gaps.slice(0,4).map(x=>`م${x.id}`).join("، ")} بعد التدخل المهني.</li><li>توجيه الدعم المستهدف للحالات المتكررة، والتحقق من الحالات ذات الظهور الواحد قبل تصعيدها.</li><li>استثمار الممارسات القوية في ${strengths.slice(0,3).map(x=>`م${x.id}`).join("، ")} عبر التعلم من الزملاء والزيارات التبادلية.</li><li>مقارنة الفترة التالية بهذه الفترة لقياس التحسن والتراجع وإغلاق المتابعة عند ثبوت التحسن.</li></ul>
    <h3>${internal?"12":"11"}. الخلاصة التنفيذية</h3><p id="officialRecommendations">يعتمد القرار القيادي على الزيارة المعتمدة لا على عدد السجلات الخام، وعلى تكرار المؤشر في زيارات مستقلة لا على ظهور جزئي منفرد. الأولوية هي تحويل نتائج الرصد إلى تدخل محدد ثم إعادة القياس، مع المحافظة على جوانب القوة وعدم تعميم الأحكام خارج حجم البيانات المتاح.</p>
    <div class="report-signatures" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:34px;padding-top:18px;border-top:2px solid #0d5f66;text-align:center"><div><span>معدّة التقرير</span><br><strong>${REPORT_INFO.preparedBy}</strong></div><div><span>المديرة المساعدة</span><br><strong>${REPORT_INFO.assistantPrincipal}</strong></div><div><span>مديرة المدرسة</span><br><strong>${REPORT_INFO.principal}</strong></div></div>
  </div>`;
}

// Keep narrative editor compatible with V4 report.
document.addEventListener("change",e=>{ if(e.target?.id==="reportLeadershipSource" || e.target?.id==="reportType") generateReport(); });


/* =========================================================
   V6.1 — RELATIONAL REPAIR LAYER
   Fixes department membership, reactive filters, leadership linkage,
   subject coverage, and restores the V4 leadership-source report engine.
========================================================= */
function v61TeacherDeptIds(t){
  const ids=new Set();
  if(t?.department_id!==undefined && t?.department_id!==null && String(t.department_id)!=="") ids.add(String(t.department_id));
  visits.filter(v=>String(v.teacher_id)===String(t?.id) && v.department_id!==undefined && v.department_id!==null && String(v.department_id)!=="").forEach(v=>ids.add(String(v.department_id)));
  return [...ids];
}
function v61TeachersForDept(dept){
  const all=activeRows(teachers);
  if(!dept) return all;
  return all.filter(t=>v61TeacherDeptIds(t).includes(String(dept)));
}
function v61TeacherDeptName(t, preferredDept=""){
  if(preferredDept && v61TeacherDeptIds(t).includes(String(preferredDept))) return v5DeptName(preferredDept);
  const ids=v61TeacherDeptIds(t); return ids.length?v5DeptName(ids[0]):"غير محدد";
}
function v61TeacherLastDept(rows,teacherId){
  const vs=rows.filter(v=>String(v.teacher_id)===String(teacherId)).slice().sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date)));
  return vs[0]?.department_id || teachers.find(t=>String(t.id)===String(teacherId))?.department_id || "";
}
function v61ConfiguredSubjectsForDept(t,dept){ return v6ConfiguredSubjects(t); }

function renderLeadershipTracking(){
  v5PrepareFilters(); const out=$("leadershipTrackingOutput"); if(!out)return;
  const observer=$("leadershipObserverFilter")?.value||""; const month=$("leadershipMonthFilter")?.value||availableMonths()[0]||""; const dept=$("leadershipDeptFilter")?.value||"";
  if($("leadershipMonthFilter")&&!$("leadershipMonthFilter").value&&month) $("leadershipMonthFilter").value=month;
  if(!observer){ out.innerHTML=`<article class="panel"><div class="empty-state">اختاري عضو القيادة لعرض سجل التغطية بالتفصيل.</div></article>`; return; }
  const scopeTeachers=v61TeachersForDept(dept);
  const approved=v6LeadershipSubjectRows(observer,month,dept);
  const visitedIds=new Set(approved.map(v=>String(v.teacher_id))); const notVisited=scopeTeachers.filter(t=>!visitedIds.has(String(t.id)));
  const p=v5Profile(observer);
  const teacherRows=[...visitedIds].map(id=>{ const t=scopeTeachers.find(x=>String(x.id)===id)||teachers.find(x=>String(x.id)===id); const vs=approved.filter(v=>String(v.teacher_id)===id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date))); const last=vs[0]; const configured=t?v6ConfiguredSubjects(t):[]; const covered=[...new Set(vs.map(v=>v6VisitSubject(v)).filter(x=>configured.includes(x)))]; const missing=configured.filter(x=>!covered.includes(x)); const special=t&&v6TeacherCoverageMode(t)==="teacher_only"; return `<tr><td>${esc(v5TeacherName(id))}</td><td>${esc(v5DeptName(last?.department_id||v61TeacherLastDept(v5RowsForScope(month,dept),id)))}</td><td>${vs.map(v=>`${esc(formatDate(v.visit_date))} — <strong>${esc(v6VisitSubject(v)||"غير محدد")}</strong> — ${esc(ratingLabel(v.overall_rating))}${v._shared?" — 👥 مشتركة":""}`).join("<br>")}</td><td>${special?"لا يطبق":(covered.join("، ")||"—")}</td><td>${special?"متابعة بالمعلمة":(missing.join("، ")||"اكتملت المواد")}</td></tr>`; }).join("");
  const partialSubject=scopeTeachers.filter(t=>visitedIds.has(String(t.id)) && v6TeacherCoverageMode(t)==="subject_based" && v6ConfiguredSubjects(t).length).filter(t=>{const vs=approved.filter(v=>String(v.teacher_id)===String(t.id)); const covered=[...new Set(vs.map(v=>v6VisitSubject(v)))]; return v6ConfiguredSubjects(t).some(x=>!covered.includes(x));});
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تقرير متابعة زيارات ${esc(p?.full_name||p?.email||"")}</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")} • ${esc(leadershipLevel(p))}</p></div><div class="v5-kpis"><b>${approved.length}<small>زيارات فعلية</small></b><b>${visitedIds.size}<small>معلمات تمت زيارتهن</small></b><b>${notVisited.length}<small>لم تتم زيارتهن</small></b><b>${partialSubject.length}<small>زارتهن وبقيت مواد</small></b></div></div>
  <h4>تمت زيارتهن — مع المادة والحكم</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الزيارة / المادة / الحكم</th><th>مواد تمت تغطيتها</th><th>المتبقي</th></tr></thead><tbody>${teacherRows||`<tr><td colspan="5">لا توجد زيارات لهذا العضو في النطاق المحدد.</td></tr>`}</tbody></table></div>
  <h4>لم تتم زيارتهن في النطاق المحدد</h4><div class="v5-chip-list">${notVisited.map(t=>`<span>${esc(t.full_name)} <small>• ${esc(v61TeacherDeptName(t,dept))}</small></span>`).join("")||"اكتملت تغطية المعلمات في هذا النطاق"}</div>
  <div class="analysis-note">التغطية هنا مرتبطة فعليًا بسجل عضو القيادة المختار. زيارة المعلمة لا تعني اكتمال موادها، والزيارة المشتركة تظهر مرة واحدة مع بقاء حكم العضو المختار في تقريره الشخصي.</div></article>`;
}

function renderDepartment360(){
  v5PrepareFilters(); const out=$("department360Output"); if(!out)return;
  const dept=$("dept360Filter")?.value||""; const month=$("dept360MonthFilter")?.value||availableMonths()[0]||""; if($("dept360MonthFilter")&&!$("dept360MonthFilter").value&&month) $("dept360MonthFilter").value=month;
  if(!dept){ out.innerHTML=`<article class="panel"><div class="empty-state">اختاري القسم لعرض تحليل 360°.</div></article>`; return; }
  const rows=v5RowsForScope(month,dept), approved=v5ApprovedVisits(rows), ts=v61TeachersForDept(dept), visited=new Set(approved.map(v=>String(v.teacher_id)));
  const diag=ts.map(t=>({t,d:v5TeacherDiagnosis(rows,t.id),n:approved.filter(v=>String(v.teacher_id)===String(t.id)).length,c:v6TeacherSubjectCoverage(t,rows)}));
  const stats={}; approved.forEach(v=>v5CriteriaForVisit(v.id).forEach(r=>{const c=String(r.criterion_no);(stats[c]||={total:0,partial:0});stats[c].total++;if(num(r.rating)===1)stats[c].partial++;})); const priorities=Object.entries(stats).sort((a,b)=>pct(b[1].partial,b[1].total)-pct(a[1].partial,a[1].total)).slice(0,5);
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(v5DeptName(dept))} — تحليل 360°</h3><p>${esc(v5MonthLabel(month))}</p></div><div class="v5-kpis"><b>${ts.length}<small>معلمات القسم</small></b><b>${visited.size}<small>تمت زيارتهن</small></b><b>${approved.length}<small>زيارات معتمدة</small></b><b>${pct(visited.size,ts.length)}%<small>تغطية القسم</small></b></div></div><h4>المعلمات وقراءة المتابعة</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>زيارات</th><th>الحالة</th><th>تغطية المادة</th><th>المعايير الجزئية</th><th>القراءة</th></tr></thead><tbody>${diag.map(({t,d,n,c})=>`<tr><td>${esc(t.full_name)}</td><td>${n}</td><td>${v5Badge(d)}</td><td>${v6CoverageBadge(c)}</td><td>${d.partial.length?`م${d.partial.join("، م")}`:"—"}</td><td>${esc(d.reason)}</td></tr>`).join("")||`<tr><td colspan="6">لا توجد معلمات مرتبطة بهذا القسم في البيانات الحالية.</td></tr>`}</tbody></table></div><h4>أعلى أولويات المعايير داخل القسم</h4><div class="v5-priority-grid">${priorities.map(([c,x])=>`<div><strong>م${c}</strong><b>${pct(x.partial,x.total)}%</b><small>يفي جزئيًا • ${x.partial}/${x.total} رصدًا</small></div>`).join("")||"لا توجد بيانات معايير كافية"}</div><div class="analysis-note">عضوية القسم تُستنتج من بيانات المعلمة ومن زياراتها الفعلية، لذلك لا تضيع المعلمة إذا كان department_id غير محفوظ في سجل teachers.</div></article>`;
}

function renderFollowupCenter(){
  v5PrepareFilters(); const out=$("followupCenterOutput"); if(!out)return;
  const month=$("followupMonthFilter")?.value||availableMonths()[0]||""; const dept=$("followupDeptFilter")?.value||""; if($("followupMonthFilter")&&!$("followupMonthFilter").value&&month) $("followupMonthFilter").value=month;
  const rows=v5RowsForScope(month,dept); const ts=v61TeachersForDept(dept); const list=ts.map(t=>({t,d:v5TeacherDiagnosis(rows,t.id)})).filter(x=>["priority","targeted","verify","initial"].includes(x.d.key)).sort((a,b)=>b.d.score-a.d.score||a.t.full_name.localeCompare(b.t.full_name,"ar"));
  const counts=k=>list.filter(x=>x.d.key===k).length;
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>الحالات التي تحتاج إجراء — ${esc(v5MonthLabel(month))}</h3><p>${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p></div><div class="v5-kpis"><b>${counts("priority")}<small>أولى بالرعاية</small></b><b>${counts("targeted")}<small>دعم مستهدف</small></b><b>${counts("verify")}<small>تحقق</small></b><b>${counts("initial")}<small>قراءة أولية</small></b></div></div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الحالة</th><th>لماذا؟</th><th>القرار المقترح</th></tr></thead><tbody>${list.map(({t,d})=>`<tr><td>${esc(t.full_name)}</td><td>${esc(v61TeacherDeptName(t,dept)||v5DeptName(v61TeacherLastDept(rows,t.id)))}</td><td>${v5Badge(d)}</td><td>${esc(d.reason)}</td><td>${d.key==="priority"?"دعم مستهدف + إعادة رصد":d.key==="targeted"?"تدخل مهني موجه":d.key==="verify"?"زيارة مستقلة للتحقق":"استكمال الرصد"}</td></tr>`).join("")||`<tr><td colspan="5">لا توجد حالات متابعة في النطاق المحدد.</td></tr>`}</tbody></table></div></article>`;
}

function v6PrepareSubjectFilters(){
  v5FillSelect("subjectCoverageMonth",availableMonths(),"كل الأشهر",x=>x,x=>v5MonthLabel(x));
  v5FillSelect("subjectCoverageDept",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name);
  const dept=$("subjectCoverageDept")?.value||""; const ts=v61TeachersForDept(dept);
  v5FillSelect("subjectCoverageSubject",v6AllConfiguredSubjects(ts),"اختر المادة",x=>x,x=>x);
}
function renderSubjectCoverage(){
  const out=$("subjectCoverageOutput"); if(!out) return; v6PrepareSubjectFilters();
  const month=$("subjectCoverageMonth")?.value || availableMonths()[0] || ""; const dept=$("subjectCoverageDept")?.value || ""; const chosen=$("subjectCoverageSubject")?.value || "";
  if($("subjectCoverageMonth")&&!$("subjectCoverageMonth").value&&month) $("subjectCoverageMonth").value=month;
  const ts=v61TeachersForDept(dept), rows=v5RowsForScope(month,dept); const coverage=ts.map(t=>({t,c:v6TeacherSubjectCoverage(t,rows)})); const subjectBased=coverage.filter(x=>x.c.mode==="subject_based"&&x.c.configured.length); const special=coverage.filter(x=>x.c.mode==="teacher_only"); const slots=subjectBased.reduce((n,x)=>n+x.c.configured.length,0), coveredSlots=subjectBased.reduce((n,x)=>n+x.c.covered.length,0), teacherVisited=coverage.filter(x=>x.c.visitCount>0).length; const allSubjects=v6AllConfiguredSubjects(ts); const subject=chosen&&allSubjects.includes(chosen)?chosen:(allSubjects[0]||""); if($("subjectCoverageSubject")&&subject) $("subjectCoverageSubject").value=subject; const ss=subject?v6SubjectStats(rows,subject):{rows:[],teachers:new Set(),priority:[]}; const targetTeachers=ts.filter(t=>v6ConfiguredSubjects(t).includes(subject)); const subjectCoverage=pct(targetTeachers.filter(t=>ss.teachers.has(String(t.id))).length,targetTeachers.length);
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تحليل المواد والتغطية</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p></div><div class="v5-kpis"><b>${pct(teacherVisited,ts.length)}%<small>تغطية المعلمات</small></b><b>${pct(coveredSlots,slots)}%<small>تغطية المواد المستهدفة</small></b><b>${coveredSlots}/${slots}<small>معلمة × مادة مغطاة</small></b><b>${special.length}<small>تربية خاصة بنمط مستقل</small></b></div></div><div class="analysis-note">تغطية المعلمة لا تعني تلقائيًا تغطية كل موادها. عضوية القسم تُقرأ من سجل المعلمة ومن زياراتها الفعلية.</div><h4>مصفوفة تغطية المعلمة × المادة</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الحالة</th><th>تمت تغطيته</th><th>المتبقي</th><th>الزيارات</th></tr></thead><tbody>${coverage.map(({t,c})=>`<tr><td>${esc(t.full_name)}</td><td>${esc(v61TeacherDeptName(t,dept))}</td><td>${v6CoverageBadge(c)}</td><td>${c.mode==="teacher_only"?(c.visitCount?"زيارة المعلمة مكتملة":"—"):(c.covered.map(x=>`✓ ${esc(x)}`).join("<br>")||"—")}</td><td>${c.mode==="teacher_only"?"لا يطبق تحليل المواد":(c.missing.map(x=>`◷ ${esc(x)}`).join("<br>")||"لا يوجد")}</td><td>${c.visitCount}</td></tr>`).join("")||`<tr><td colspan="6">لا توجد معلمات مرتبطة بهذا القسم.</td></tr>`}</tbody></table></div><h4>تحليل مادة: ${esc(subject||"—")}</h4><div class="v5-kpis"><b>${targetTeachers.length}<small>معلمات يدرسن المادة</small></b><b>${ss.teachers.size}<small>تم رصدهن في المادة</small></b><b>${ss.rows.length}<small>زيارات المادة</small></b><b>${subjectCoverage}%<small>تغطية المادة</small></b></div><div class="v5-priority-grid">${ss.priority.map(([c,x])=>`<div><strong>م${c}</strong><b>${pct(x.partial,x.total)}%</b><small>يفي جزئيًا • ${x.partial}/${x.total} رصدًا</small></div>`).join("")||"لا توجد بيانات معايير كافية لهذه المادة"}</div></article>`;
}

// Reactive linkage: changing a selector immediately refreshes the related analysis.
document.addEventListener("change",e=>{
  const id=e.target?.id;
  if(["leadershipObserverFilter","leadershipMonthFilter","leadershipDeptFilter"].includes(id)) renderLeadershipTracking();
  if(["followupMonthFilter","followupDeptFilter"].includes(id)) renderFollowupCenter();
  if(["dept360Filter","dept360MonthFilter"].includes(id)) renderDepartment360();
  if(id==="subjectCoverageDept"){ const s=$("subjectCoverageSubject"); if(s)s.value=""; renderSubjectCoverage(); }
  if(["subjectCoverageMonth","subjectCoverageSubject"].includes(id)) renderSubjectCoverage();
});


/* =========================================================
   V7 — CENTRAL ACTUAL-VISIT ENGINE + COVERAGE REPAIR
   One source of truth for deduplication, departments, special education,
   leadership tracking, subject coverage and follow-up.
========================================================= */
function v7NormToken(x){ return v6Norm(x).replace(/[^\w\u0600-\u06FF]+/g," ").trim(); }
function v7ActualVisitKey(v){
  // A classroom period can only be one actual observation for the same teacher/class.
  // Do NOT include observer, lesson title or subject: old/shared rows may have one of them blank/different.
  // grade+period protects genuinely different observations on the same day (e.g. Sharifa case).
  return [v.teacher_id||"", String(v.visit_date||"").slice(0,10), v7NormToken(v.period_name||""), v7NormToken(v.grade_section||"")].join("||");
}
function v7VisitGroups(rows){
  const m=new Map();
  (rows||[]).forEach(v=>{ const k=v7ActualVisitKey(v); if(!m.has(k))m.set(k,[]); m.get(k).push(v); });
  return [...m.values()];
}
function v7ActualVisits(rows,{source="official",observerId=""}={}){
  const allowed=(rows||[]).filter(v=>["قيادة عليا","قيادة وسطى"].includes(leadershipLevel(v5Profile(v.observer_id))));
  const groups=v7VisitGroups(allowed);
  if(observerId){
    return groups.filter(g=>g.some(v=>String(v.observer_id)===String(observerId))).map(g=>{
      const own=g.find(v=>String(v.observer_id)===String(observerId));
      return {...own,_shared:g.length>1,_members:g,_actualKey:v7ActualVisitKey(own)};
    });
  }
  if(source==="upper" || source==="middle"){
    const level=source==="upper"?"قيادة عليا":"قيادة وسطى";
    return groups.flatMap(g=>{
      const same=g.filter(v=>leadershipLevel(v5Profile(v.observer_id))===level);
      if(!same.length)return [];
      const chosen=same[0]; return [{...chosen,_shared:g.length>1,_members:g,_actualKey:v7ActualVisitKey(chosen)}];
    });
  }
  if(source==="all") return allowed.map(v=>({...v,_shared:v7VisitGroups(allowed).some(g=>g.length>1&&g.includes(v)),_members:[v]}));
  return groups.map(g=>{
    const senior=g.find(v=>leadershipLevel(v5Profile(v.observer_id))==="قيادة عليا");
    const chosen=senior||g[0]; return {...chosen,_shared:g.length>1,_members:g,_actualKey:v7ActualVisitKey(chosen)};
  });
}
// Route every new analysis through the same actual-visit engine.
function v5VisitKey(v){ return v7ActualVisitKey(v); }
function v5VisitGroups(rows){ return v7VisitGroups(rows); }
function v5ApprovedVisits(rows){ return v7ActualVisits(rows,{source:"official"}); }
function v5VisitsForObserver(rows,observerId){ return v7ActualVisits(rows,{observerId}); }
function v4SharedKey(v){ return v7ActualVisitKey(v); }
function v4AcceptedVisits(rows,source=v4AnalysisSource()){ return v7ActualVisits(rows,{source}); }

const V7_SPECIAL_TEACHERS=["ساجده","مها الشمري","نوره الدوسري","زينب اسماعيل","ايمان عبدالرضا"];
function v7IsSpecialTeacher(t){
  const n=v6Norm(t?.full_name||"");
  if(V7_SPECIAL_TEACHERS.some(k=>n.includes(v6Norm(k)))) return true;
  return v61TeacherDeptIds(t).some(id=>v6IsSpecialDeptName(v5DeptName(id)));
}
function v6TeacherCoverageMode(t){ return v7IsSpecialTeacher(t)?"teacher_only":"subject_based"; }

function v7RowsForTeacher(rows,t){ return (rows||[]).filter(v=>String(v.teacher_id)===String(t.id)); }
function v7ActualSubject(v){
  let s=v6VisitSubject(v);
  if(s && s!=="غير محدد") return s;
  // Shared rows sometimes hold subject only on the other evaluator's row.
  for(const m of (v._members||[])){ const x=v6VisitSubject(m); if(x&&x!=="غير محدد") return x; }
  return "غير محدد";
}
function v6TeacherSubjectCoverage(t,rows){
  const actual=v7ActualVisits(v7RowsForTeacher(rows,t),{source:"official"});
  if(v6TeacherCoverageMode(t)==="teacher_only") return {mode:"teacher_only",configured:[],covered:[],missing:[],visitCount:actual.length,status:actual.length?"visited":"unvisited"};
  const configured=v6ConfiguredSubjects(t);
  const covered=[...new Set(actual.map(v=>v7ActualSubject(v)).filter(x=>configured.includes(x)))];
  const missing=configured.filter(x=>!covered.includes(x));
  return {mode:"subject_based",configured,covered,missing,visitCount:actual.length,status:!actual.length?"unvisited":(!configured.length||missing.length)?"partial":"complete"};
}
function v6SubjectStats(rows,subjectName){
  const r=v7ActualVisits(rows,{source:"official"}).filter(v=>v7ActualSubject(v)===subjectName);
  const tids=new Set(r.map(v=>String(v.teacher_id))),crit={};
  r.forEach(v=>v5CriteriaForVisit(v.id).forEach(x=>{const c=String(x.criterion_no);(crit[c]||={total:0,partial:0,high:0});crit[c].total++;if(num(x.rating)===1)crit[c].partial++;if(num(x.rating)>=3)crit[c].high++;}));
  const priority=Object.entries(crit).sort((a,b)=>pct(b[1].partial,b[1].total)-pct(a[1].partial,a[1].total)).slice(0,5);
  return {rows:r,teachers:tids,crit,priority};
}
function v7ScopeRows(month,dept){
  return visits.filter(v=>(!month||monthKey(v.visit_date)===month)&&(!dept||String(v.department_id)===String(dept)));
}
function v7TeacherDeptLabel(t,dept=""){ return v61TeacherDeptName(t,dept); }

function v5PrepareFilters(){
  const months=availableMonths();
  const configs=[
    ["leadershipMonthFilter",months,"كل الأشهر",x=>x,x=>v5MonthLabel(x)],
    ["followupMonthFilter",months,"كل الأشهر",x=>x,x=>v5MonthLabel(x)],
    ["dept360MonthFilter",months,"كل الأشهر",x=>x,x=>v5MonthLabel(x)],
    ["leadershipDeptFilter",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name],
    ["followupDeptFilter",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name],
    ["dept360Filter",activeRows(departments),"اختر القسم",x=>x.id,x=>x.name],
    ["leadershipObserverFilter",v5LeadershipProfiles(),"اختر عضو القيادة",x=>x.id,x=>`${x.full_name||x.email} — ${leadershipLevel(x)}`]
  ];
  configs.forEach(([id,rows,ph,vf,lf])=>{ const el=$(id); if(el && el.options.length<=1) v5FillSelect(id,rows,ph,vf,lf); });
}
function v7EnsureFilterOptions(){
  const force=(id,rows,ph,vf,lf)=>{const el=$(id);if(!el)return;const old=el.value;v5FillSelect(id,rows,ph,vf,lf);if(old&&[...el.options].some(o=>o.value===old))el.value=old;};
  const months=availableMonths();
  force("leadershipMonthFilter",months,"كل الأشهر",x=>x,x=>v5MonthLabel(x)); force("followupMonthFilter",months,"كل الأشهر",x=>x,x=>v5MonthLabel(x)); force("dept360MonthFilter",months,"كل الأشهر",x=>x,x=>v5MonthLabel(x));
  force("leadershipDeptFilter",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name); force("followupDeptFilter",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name); force("dept360Filter",activeRows(departments),"اختر القسم",x=>x.id,x=>x.name);
  force("leadershipObserverFilter",v5LeadershipProfiles(),"اختر عضو القيادة",x=>x.id,x=>`${x.full_name||x.email} — ${leadershipLevel(x)}`);
}
function renderLeadershipTracking(){
  v7EnsureFilterOptions(); const out=$("leadershipTrackingOutput"); if(!out)return;
  const observer=$("leadershipObserverFilter")?.value||"", month=$("leadershipMonthFilter")?.value||availableMonths()[0]||"", dept=$("leadershipDeptFilter")?.value||"";
  if(!observer){out.innerHTML=`<article class="panel"><div class="empty-state">اختاري عضو القيادة لعرض سجل التغطية بالتفصيل.</div></article>`;return;}
  const raw=v7ScopeRows(month,dept), actual=v7ActualVisits(raw,{observerId:observer}), ts=v61TeachersForDept(dept), visited=new Set(actual.map(v=>String(v.teacher_id))), notVisited=ts.filter(t=>!visited.has(String(t.id))), p=v5Profile(observer);
  const rows=[...visited].map(id=>{const t=teachers.find(x=>String(x.id)===id),vs=actual.filter(v=>String(v.teacher_id)===id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date))),c=t?v6TeacherSubjectCoverage(t,raw):null;return `<tr><td>${esc(v5TeacherName(id))}</td><td>${esc(t?v7TeacherDeptLabel(t,dept):v5DeptName(vs[0]?.department_id))}</td><td>${vs.map(v=>`${esc(formatDate(v.visit_date))} — <strong>${esc(v7ActualSubject(v))}</strong> — ${esc(ratingLabel(v.overall_rating))}${v._shared?` — 👥 مشتركة (${v._members.map(x=>esc(v5ObserverName(x.observer_id))).join(" + ")})`:""}`).join("<br>")}</td><td>${c?.mode==="teacher_only"?"متابعة بالمعلمة":(c?.covered.join("، ")||"—")}</td><td>${c?.mode==="teacher_only"?"لا يطبق":(c?.missing.join("، ")||"لا يوجد")}</td></tr>`;}).join("");
  const partial=ts.filter(t=>visited.has(String(t.id))&&v6TeacherCoverageMode(t)==="subject_based"&&v6TeacherSubjectCoverage(t,raw).missing.length);
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تقرير متابعة زيارات ${esc(p?.full_name||p?.email||"")}</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")} • ${esc(leadershipLevel(p))}</p></div><div class="v5-kpis"><b>${actual.length}<small>زيارات فعلية</small></b><b>${visited.size}<small>معلمات تمت زيارتهن</small></b><b>${notVisited.length}<small>لم تتم زيارتهن</small></b><b>${partial.length}<small>زارتهن وبقيت مواد</small></b></div></div><h4>تمت زيارتهن — المادة والحكم</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الزيارة / المادة / الحكم</th><th>المغطى</th><th>المتبقي</th></tr></thead><tbody>${rows||`<tr><td colspan="5">لا توجد زيارات لهذا العضو في النطاق.</td></tr>`}</tbody></table></div><h4>لم تتم زيارتهن</h4><div class="v5-chip-list">${notVisited.map(t=>`<span>${esc(t.full_name)} <small>• ${esc(v7TeacherDeptLabel(t,dept))}</small></span>`).join("")||"<span>اكتملت تغطية المعلمات.</span>"}</div><div class="analysis-note">العداد هنا للزيارات الفعلية بعد دمج الزيارة المشتركة. تقرير عضو القيادة يحتفظ بحكمه، بينما التحليل الرسمي يعتمد القيادة العليا عند الاشتراك.</div></article>`;
}
function renderFollowupCenter(){
  v7EnsureFilterOptions(); const out=$("followupCenterOutput"); if(!out)return;
  const month=$("followupMonthFilter")?.value||availableMonths()[0]||"",dept=$("followupDeptFilter")?.value||"",raw=v7ScopeRows(month,dept),ts=v61TeachersForDept(dept);
  const list=ts.map(t=>({t,d:v5TeacherDiagnosis(raw,t.id)})).filter(x=>x.d.key!=="stable").sort((a,b)=>b.d.score-a.d.score||a.t.full_name.localeCompare(b.t.full_name,"ar"));
  const count=k=>list.filter(x=>x.d.key===k).length;
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>الحالات التي تحتاج إجراء — ${esc(v5MonthLabel(month))}</h3><p>${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p></div><div class="v5-kpis"><b>${count("priority")}<small>أولى بالرعاية</small></b><b>${count("targeted")}<small>دعم مستهدف</small></b><b>${count("verify")}<small>تحقق</small></b><b>${count("initial")}<small>قراءة أولية</small></b><b>${count("unvisited")}<small>لم تتم الزيارة</small></b></div></div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الحالة</th><th>لماذا؟</th><th>القرار المقترح</th></tr></thead><tbody>${list.map(({t,d})=>`<tr><td>${esc(t.full_name)}</td><td>${esc(v7TeacherDeptLabel(t,dept))}</td><td>${v5Badge(d)}</td><td>${esc(d.reason)}</td><td>${d.key==="priority"?"دعم مستهدف + إعادة رصد":d.key==="targeted"?"تدخل مهني موجه":d.key==="verify"?"زيارة مستقلة للتحقق":d.key==="initial"?"استكمال الرصد":"جدولة زيارة"}</td></tr>`).join("")||`<tr><td colspan="5">لا توجد حالات متابعة.</td></tr>`}</tbody></table></div></article>`;
}
function renderDepartment360(){
  v7EnsureFilterOptions(); const out=$("department360Output"); if(!out)return;
  const dept=$("dept360Filter")?.value||"",month=$("dept360MonthFilter")?.value||availableMonths()[0]||""; if(!dept){out.innerHTML=`<article class="panel"><div class="empty-state">اختاري القسم لعرض تحليل 360°.</div></article>`;return;}
  const raw=v7ScopeRows(month,dept),actual=v7ActualVisits(raw,{source:"official"}),ts=v61TeachersForDept(dept),visited=new Set(actual.map(v=>String(v.teacher_id)));
  const diag=ts.map(t=>({t,d:v5TeacherDiagnosis(raw,t.id),n:actual.filter(v=>String(v.teacher_id)===String(t.id)).length,c:v6TeacherSubjectCoverage(t,raw)}));
  const stats={};actual.forEach(v=>v5CriteriaForVisit(v.id).forEach(r=>{const c=String(r.criterion_no);(stats[c]||={total:0,partial:0});stats[c].total++;if(num(r.rating)===1)stats[c].partial++;}));const priorities=Object.entries(stats).sort((a,b)=>pct(b[1].partial,b[1].total)-pct(a[1].partial,a[1].total)).slice(0,5);
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(v5DeptName(dept))} — تحليل 360°</h3><p>${esc(v5MonthLabel(month))}</p></div><div class="v5-kpis"><b>${ts.length}<small>معلمات القسم</small></b><b>${visited.size}<small>تمت زيارتهن</small></b><b>${actual.length}<small>زيارات فعلية معتمدة</small></b><b>${pct(visited.size,ts.length)}%<small>تغطية القسم</small></b></div></div><h4>المعلمات وقراءة المتابعة</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>زيارات فعلية</th><th>الحالة</th><th>تغطية المادة</th><th>المعايير الجزئية</th><th>القراءة</th></tr></thead><tbody>${diag.map(({t,d,n,c})=>`<tr><td>${esc(t.full_name)}</td><td>${n}</td><td>${v5Badge(d)}</td><td>${v6CoverageBadge(c)}</td><td>${d.partial.length?`م${d.partial.join("، م")}`:"—"}</td><td>${esc(d.reason)}</td></tr>`).join("")||`<tr><td colspan="6">لا توجد معلمات مرتبطة بالقسم.</td></tr>`}</tbody></table></div><h4>أعلى أولويات المعايير داخل القسم</h4><div class="v5-priority-grid">${priorities.map(([c,x])=>`<div><strong>م${c}</strong><b>${pct(x.partial,x.total)}%</b><small>يفي جزئيًا • ${x.partial}/${x.total} رصدًا</small></div>`).join("")||"لا توجد بيانات معايير كافية"}</div><div class="analysis-note">كل الأعداد هنا مبنية على محرك الزيارة الفعلية نفسه؛ الزيارة المشتركة لا تضاعف العدد.</div></article>`;
}
function v6PrepareSubjectFilters(){
  const force=(id,rows,ph,vf,lf)=>{const el=$(id);if(!el)return;const old=el.value;v5FillSelect(id,rows,ph,vf,lf);if(old&&[...el.options].some(o=>o.value===old))el.value=old;};
  force("subjectCoverageMonth",availableMonths(),"كل الأشهر",x=>x,x=>v5MonthLabel(x));force("subjectCoverageDept",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name);
  const dept=$("subjectCoverageDept")?.value||"",ts=v61TeachersForDept(dept);force("subjectCoverageSubject",v6AllConfiguredSubjects(ts),"اختر المادة",x=>x,x=>x);
}
function renderSubjectCoverage(){
  const out=$("subjectCoverageOutput");if(!out)return;v6PrepareSubjectFilters();
  const month=$("subjectCoverageMonth")?.value||availableMonths()[0]||"",dept=$("subjectCoverageDept")?.value||"",chosen=$("subjectCoverageSubject")?.value||"",ts=v61TeachersForDept(dept),raw=v7ScopeRows(month,dept),coverage=ts.map(t=>({t,c:v6TeacherSubjectCoverage(t,raw)})),subjectBased=coverage.filter(x=>x.c.mode==="subject_based"&&x.c.configured.length),special=coverage.filter(x=>x.c.mode==="teacher_only"),slots=subjectBased.reduce((n,x)=>n+x.c.configured.length,0),coveredSlots=subjectBased.reduce((n,x)=>n+x.c.covered.length,0),teacherVisited=coverage.filter(x=>x.c.visitCount>0).length,allSubjects=v6AllConfiguredSubjects(ts),subject=chosen&&allSubjects.includes(chosen)?chosen:(allSubjects[0]||"");if($("subjectCoverageSubject")&&subject)$("subjectCoverageSubject").value=subject;const ss=subject?v6SubjectStats(raw,subject):{rows:[],teachers:new Set(),priority:[]},target=ts.filter(t=>v6ConfiguredSubjects(t).includes(subject)),subjectPct=pct(target.filter(t=>ss.teachers.has(String(t.id))).length,target.length);
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تحليل المواد والتغطية</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p></div><div class="v5-kpis"><b>${pct(teacherVisited,ts.length)}%<small>تغطية المعلمات</small></b><b>${pct(coveredSlots,slots)}%<small>تغطية المواد المستهدفة</small></b><b>${coveredSlots}/${slots}<small>معلمة × مادة مغطاة</small></b><b>${special.length}<small>تربية خاصة بنمط مستقل</small></b></div></div><div class="analysis-note">لا تُعد المعلمة مكتملة المواد إلا إذا وُجدت زيارة فعلية لكل مادة مسندة إليها. التوحد وصعوبات التعلم والدمج تُحسب بالمعلمة فقط.</div><h4>مصفوفة تغطية المعلمة × المادة</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الحالة</th><th>تمت تغطيته</th><th>المتبقي</th><th>الزيارات الفعلية</th></tr></thead><tbody>${coverage.map(({t,c})=>`<tr><td>${esc(t.full_name)}</td><td>${esc(v7TeacherDeptLabel(t,dept))}</td><td>${v6CoverageBadge(c)}</td><td>${c.mode==="teacher_only"?(c.visitCount?"تمت زيارة المعلمة":"—"):(c.covered.map(x=>`✓ ${esc(x)}`).join("<br>")||"—")}</td><td>${c.mode==="teacher_only"?"لا يطبق تحليل المواد":(c.missing.map(x=>`◷ ${esc(x)}`).join("<br>")||"لا يوجد")}</td><td>${c.visitCount}</td></tr>`).join("")||`<tr><td colspan="6">لا توجد معلمات مرتبطة بالقسم.</td></tr>`}</tbody></table></div><h4>تحليل مادة: ${esc(subject||"—")}</h4><div class="v5-kpis"><b>${target.length}<small>معلمات يدرسن المادة</small></b><b>${ss.teachers.size}<small>تم رصدهن في المادة</small></b><b>${ss.rows.length}<small>زيارات المادة الفعلية</small></b><b>${subjectPct}%<small>تغطية المادة</small></b></div><div class="v5-priority-grid">${ss.priority.map(([c,x])=>`<div><strong>م${c}</strong><b>${pct(x.partial,x.total)}%</b><small>يفي جزئيًا • ${x.partial}/${x.total} رصدًا</small></div>`).join("")||"لا توجد بيانات معايير كافية لهذه المادة"}</div></article>`;
}




/* =========================================================
   V7.1 — VERIFIED SUBJECT ALIASES + LEADERSHIP UI BINDING
========================================================= */
function v71BindLeadershipControls(){
  ["leadershipObserverFilter","leadershipMonthFilter","leadershipDeptFilter"].forEach(id=>{
    const el=$(id); if(!el || el.dataset.v71Bound==="1") return;
    el.dataset.v71Bound="1";
    el.addEventListener("change",()=>renderLeadershipTracking());
  });
  const btn=document.querySelector('#leadershipTrackingView .btn-primary');
  if(btn && btn.dataset.v71Bound!=="1"){
    btn.dataset.v71Bound="1";
    btn.addEventListener("click",()=>renderLeadershipTracking());
  }
}
function v71FindLeadershipProfile(value){
  if(!value) return null;
  return profiles.find(p=>String(p.id)===String(value)) ||
         profiles.find(p=>String(p.user_id||"")===String(value)) ||
         profiles.find(p=>v6Norm(p.full_name||p.email)===v6Norm(value));
}
// Stable select values even if a profile schema uses user_id instead of id.
function v71LeadershipValue(p){ return String(p?.id ?? p?.user_id ?? p?.email ?? p?.full_name ?? ""); }
function v7EnsureFilterOptions(){
  const force=(id,rows,ph,vf,lf)=>{const el=$(id);if(!el)return;const old=el.value;v5FillSelect(id,rows,ph,vf,lf);if(old&&[...el.options].some(o=>o.value===old))el.value=old;};
  const months=availableMonths();
  force("leadershipMonthFilter",months,"كل الأشهر",x=>x,x=>v5MonthLabel(x)); force("followupMonthFilter",months,"كل الأشهر",x=>x,x=>v5MonthLabel(x)); force("dept360MonthFilter",months,"كل الأشهر",x=>x,x=>v5MonthLabel(x));
  force("leadershipDeptFilter",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name); force("followupDeptFilter",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name); force("dept360Filter",activeRows(departments),"اختر القسم",x=>x.id,x=>x.name);
  force("leadershipObserverFilter",v5LeadershipProfiles(),"اختر عضو القيادة",x=>v71LeadershipValue(x),x=>`${x.full_name||x.email} — ${leadershipLevel(x)}`);
  v71BindLeadershipControls();
}
function v71ObserverMatches(v,selected){
  const p=v71FindLeadershipProfile(selected); if(!p) return false;
  const ids=[p.id,p.user_id].filter(x=>x!==undefined&&x!==null).map(String);
  return ids.includes(String(v.observer_id));
}
function renderLeadershipTracking(){
  v7EnsureFilterOptions(); const out=$("leadershipTrackingOutput"); if(!out)return;
  const selected=$("leadershipObserverFilter")?.value||"", month=$("leadershipMonthFilter")?.value||availableMonths()[0]||"", dept=$("leadershipDeptFilter")?.value||"";
  const p=v71FindLeadershipProfile(selected);
  if(!p){out.innerHTML=`<article class="panel"><div class="empty-state">اختاري عضو القيادة لعرض سجل التغطية بالتفصيل.</div></article>`;return;}
  const raw=v7ScopeRows(month,dept);
  // Resolve actual DB observer id from the selected profile, then use the central grouping engine.
  const matchingRaw=raw.filter(v=>v71ObserverMatches(v,selected));
  const actual=v7VisitGroups(raw.filter(v=>["قيادة عليا","قيادة وسطى"].includes(leadershipLevel(v5Profile(v.observer_id)))))
    .filter(g=>g.some(v=>matchingRaw.includes(v)))
    .map(g=>{const own=g.find(v=>matchingRaw.includes(v));return {...own,_shared:g.length>1,_members:g,_actualKey:v7ActualVisitKey(own)};});
  const ts=v61TeachersForDept(dept),visited=new Set(actual.map(v=>String(v.teacher_id))),notVisited=ts.filter(t=>!visited.has(String(t.id)));
  const rows=[...visited].map(id=>{const t=teachers.find(x=>String(x.id)===id),vs=actual.filter(v=>String(v.teacher_id)===id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date))),c=t?v6TeacherSubjectCoverage(t,raw):null;return `<tr><td>${esc(v5TeacherName(id))}</td><td>${esc(t?v7TeacherDeptLabel(t,dept):v5DeptName(vs[0]?.department_id))}</td><td>${vs.map(v=>`${esc(formatDate(v.visit_date))} — <strong>${esc(v7ActualSubject(v))}</strong> — ${esc(ratingLabel(v.overall_rating))}${v._shared?` — 👥 مشتركة (${v._members.map(x=>esc(v5ObserverName(x.observer_id))).join(" + ")})`:""}`).join("<br>")}</td><td>${c?.mode==="teacher_only"?"متابعة بالمعلمة":(c?.covered.join("، ")||"—")}</td><td>${c?.mode==="teacher_only"?"لا يطبق":(c?.missing.join("، ")||"لا يوجد")}</td></tr>`;}).join("");
  const partial=ts.filter(t=>visited.has(String(t.id))&&v6TeacherCoverageMode(t)==="subject_based"&&v6TeacherSubjectCoverage(t,raw).missing.length);
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تقرير متابعة زيارات ${esc(p.full_name||p.email||"")}</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")} • ${esc(leadershipLevel(p))}</p></div><div class="v5-kpis"><b>${actual.length}<small>زيارات فعلية</small></b><b>${visited.size}<small>معلمات تمت زيارتهن</small></b><b>${notVisited.length}<small>لم تتم زيارتهن</small></b><b>${partial.length}<small>زارتهن وبقيت مواد</small></b></div></div><h4>تمت زيارتهن — المادة والحكم</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الزيارة / المادة / الحكم</th><th>المغطى</th><th>المتبقي</th></tr></thead><tbody>${rows||`<tr><td colspan="5">لا توجد زيارات لهذا العضو في النطاق.</td></tr>`}</tbody></table></div><h4>لم تتم زيارتهن</h4><div class="v5-chip-list">${notVisited.map(t=>`<span>${esc(t.full_name)} <small>• ${esc(v7TeacherDeptLabel(t,dept))}</small></span>`).join("")||"<span>اكتملت تغطية المعلمات.</span>"}</div><div class="analysis-note">العداد للزيارات الفعلية بعد دمج الزيارة المشتركة. تغطية المواد تُقرأ من المواد المسندة لكل معلمة، وليس من مادة الزيارة الوحيدة.</div></article>`;
}


/* =========================================================
   BOOT
========================================================= */

async function boot() {
  try {
    const hasSession =
      await ensureSession();

    if (
      !hasSession
    ) {
      return;
    }

    await loadCurrentProfile();

    await loadAll();

    fillUI();

    bindNavigation();

    bindStaticEvents();

    bindVisitDraftAutosave();

    renderAll();

    if (
      $("visitDate") &&
      !$("visitDate").value
    ) {
      $("visitDate").value =
        new Date()
          .toISOString()
          .slice(
            0,
            10
          );
    }

    showView("dashboard");

    offerVisitDraftRestore();
  }
  catch (
    error
  ) {
    showBootError(
      error
    );
  }
}

document.addEventListener(
  "DOMContentLoaded",
  boot
);

/* =========================================================
   V7.2 INTEGRATED LEADERSHIP COMPLETION
   All new views consume V7 central actual-visit engine.
========================================================= */
function v72FillSelect(id, options, placeholder){
  const el=$(id); if(!el) return; const old=el.value;
  el.innerHTML=(placeholder!==null?`<option value="">${esc(placeholder||"الكل")}</option>`:"")+options.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join("");
  if([...el.options].some(o=>o.value===old)) el.value=old;
}
function v72Months(){ return [...new Set(visits.map(v=>String(v.visit_date||"").slice(0,7)).filter(Boolean))].sort().reverse(); }
function v72InitCommon(monthId,deptId){
  if(monthId){ const m=$(monthId); if(m && !m.options.length){v72FillSelect(monthId,v72Months().map(x=>({value:x,label:v5MonthLabel(x)})),null); if(!m.value)m.value=v72Months()[0]||"";} }
  if(deptId){ const d=$(deptId); if(d && d.options.length<=1){v72FillSelect(deptId,departments.map(x=>({value:String(x.id),label:x.name})),"كل الأقسام");} }
}
function v72Reliability(n){return n>=3?"مرتفعة":n===2?"متوسطة":n===1?"منخفضة":"غير متاحة";}
function v72TeacherActual(tid,month=""){let r=visits.filter(v=>String(v.teacher_id)===String(tid)&&(!month||String(v.visit_date||"").startsWith(month)));return v7ActualVisits(r,{source:"official"});}
function v72TeacherDept(t){const v=visits.find(x=>String(x.teacher_id)===String(t.id));return v7TeacherDeptLabel(t,v?.department_id||"");}
function renderTeacher360(){
  v72InitCommon("teacher360Month"); const tf=$("teacher360Filter"); if(tf&&!tf.options.length)v72FillSelect("teacher360Filter",teachers.map(t=>({value:String(t.id),label:t.full_name})),"اختاري المعلمة");
  const out=$("teacher360Output"),tid=tf?.value,month=$("teacher360Month")?.value||""; if(!out)return;if(!tid){out.innerHTML='<article class="panel">اختاري المعلمة لعرض البطاقة.</article>';return;}
  const t=teachers.find(x=>String(x.id)===String(tid)), raw=visits.filter(v=>String(v.teacher_id)===String(tid)&&(!month||String(v.visit_date||"").startsWith(month))), actual=v7ActualVisits(raw,{source:"official"}), cov=v6TeacherSubjectCoverage(t,raw),diag=v5TeacherDiagnosis(raw,tid);
  const timeline=actual.sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date))).map(v=>{const parts=v5CriteriaForVisit(v.id).filter(x=>num(x.rating)===1).map(x=>`م${x.criterion_no}`);return `<tr><td>${esc(formatDate(v.visit_date))}</td><td>${esc(v7ActualSubject(v))}</td><td>${esc(v5ObserverName(v.observer_id))}${v._shared?`<br><small>مشتركة: ${v._members.map(x=>esc(v5ObserverName(x.observer_id))).join(" + ")}</small>`:""}</td><td>${esc(ratingLabel(v.overall_rating))}</td><td>${parts.join("، ")||"—"}</td></tr>`}).join("");
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(t.full_name)}</h3><p>${esc(v72TeacherDept(t))} • ${esc(v5MonthLabel(month))}</p></div><div class="v5-kpis"><b>${actual.length}<small>زيارات فعلية</small></b><b>${esc(v72Reliability(actual.length))}<small>موثوقية القراءة</small></b><b>${v5Badge(diag)}<small>الحالة</small></b><b>${v6CoverageBadge(cov)}<small>تغطية المواد</small></b></div></div><h4>المواد</h4><p><strong>المسندة:</strong> ${cov.mode==="teacher_only"?"متابعة بالمعلمة":esc(cov.configured.join("، ")||"—")} &nbsp; <strong>المغطاة:</strong> ${esc(cov.covered?.join("، ")||"—")} &nbsp; <strong>المتبقية:</strong> ${esc(cov.missing?.join("، ")||"—")}</p><h4>الخط الزمني للزيارات</h4><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المادة</th><th>المقيم</th><th>الحكم</th><th>جزئي</th></tr></thead><tbody>${timeline||'<tr><td colspan="5">لا توجد زيارات في النطاق.</td></tr>'}</tbody></table></div><div class="analysis-note"><strong>قراءة المتابعة:</strong> ${esc(diag.reason)} • <strong>الإجراء:</strong> ${esc(diag.action||diag.recommendation||"استكمال الرصد حسب الحاجة")}</div></article>`;
}
function renderCriteriaMatrix(){
  v72InitCommon("matrixMonth","matrixDept");const month=$("matrixMonth")?.value||"",dept=$("matrixDept")?.value||"",out=$("criteriaMatrixOutput");if(!out)return;const ts=dept?v61TeachersForDept(dept):teachers.filter(t=>visits.some(v=>String(v.teacher_id)===String(t.id)&&(!month||String(v.visit_date||"").startsWith(month))));
  const rows=ts.map(t=>{const av=v7ActualVisits(v7ScopeRows(month,dept).filter(v=>String(v.teacher_id)===String(t.id)),{source:"official"});const cells=[];for(let c=1;c<=18;c++){let rr=[];av.forEach(v=>rr.push(...v5CriteriaForVisit(v.id).filter(x=>num(x.criterion_no)===c).map(x=>num(x.rating))));const partial=rr.filter(x=>x===1).length;cells.push(`<td title="${rr.length} رصد • ${partial} جزئي">${!rr.length?'—':partial?`◐ ${partial}/${rr.length}`:'✓'}</td>`)}return `<tr><td>${esc(t.full_name)}</td><td>${av.length}</td>${cells.join('')}</tr>`}).join('');
  out.innerHTML=`<article class="panel v5-report"><h3>مصفوفة المعلمات × م1–م18</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"كل الأقسام")}</p><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>زيارات</th>${Array.from({length:18},(_,i)=>`<th>م${i+1}</th>`).join('')}</tr></thead><tbody>${rows||'<tr><td colspan="20">لا توجد بيانات.</td></tr>'}</tbody></table></div><div class="analysis-note">◐ يعني وجود تقييم جزئي في المعيار. ✓ يعني أن الرصد المتاح لا يتضمن جزئيًا. — لا يوجد رصد.</div></article>`;
}
function v72PriorityFor(t,raw){const av=v7ActualVisits(raw.filter(v=>String(v.teacher_id)===String(t.id)),{source:"official"}),cov=v6TeacherSubjectCoverage(t,raw),d=v5TeacherDiagnosis(raw,t.id);let score=0,reasons=[];if(!av.length){score+=60;reasons.push("لم تتم زيارتها");}if(cov.mode!=="teacher_only"&&cov.missing?.length){score+=20+cov.missing.length*3;reasons.push(`مواد متبقية: ${cov.missing.join("، ")}`);}if(d.level?.includes("رعاية")||d.status?.includes("رعاية")){score+=50;reasons.push("أولوية رعاية");}else if(d.level?.includes("دعم")||d.status?.includes("دعم")){score+=35;reasons.push("دعم مستهدف");}else if(d.level?.includes("تحقق")||d.status?.includes("تحقق")){score+=25;reasons.push("زيارة تحقق");}if(av.length===1){score+=10;reasons.push("موثوقية منخفضة");}return {t,av,cov,d,score,reasons};}
function renderNextVisits(){v72InitCommon("nextVisitsMonth","nextVisitsDept");const month=$("nextVisitsMonth")?.value||"",dept=$("nextVisitsDept")?.value||"",out=$("nextVisitsOutput");if(!out)return;const raw=v7ScopeRows(month,dept),ts=dept?v61TeachersForDept(dept):teachers.filter(t=>visits.some(v=>String(v.teacher_id)===String(t.id))),items=ts.map(t=>v72PriorityFor(t,raw)).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);out.innerHTML=`<article class="panel v5-report"><h3>خطة الزيارات القادمة — ترتيب مقترح</h3><div class="table-wrap"><table><thead><tr><th>الأولوية</th><th>المعلمة</th><th>القسم</th><th>السبب</th><th>المادة المقترحة</th><th>زيارات فعلية</th></tr></thead><tbody>${items.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.t.full_name)}</td><td>${esc(v72TeacherDept(x.t))}</td><td>${esc(x.reasons.join(" • "))}</td><td>${esc(x.cov.mode==="teacher_only"?"متابعة المعلمة":(x.cov.missing?.[0]||"حسب أولوية الرصد"))}</td><td>${x.av.length}</td></tr>`).join('')||'<tr><td colspan="6">لا توجد أولويات في النطاق.</td></tr>'}</tbody></table></div><div class="analysis-note">الترتيب توصية قيادية وليس حكمًا آليًا؛ لا يفترض ضرورة تغطية كل مواد المعلمة في شهر واحد.</div></article>`;}
function v72Quality(month){const raw=visits.filter(v=>!month||String(v.visit_date||"").startsWith(month)),issues=[];raw.forEach(v=>{if(!teachers.some(t=>String(t.id)===String(v.teacher_id)))issues.push([v.id,"زيارة بلا معلمة مرتبطة"]);if(!v.department_id)issues.push([v.id,"زيارة بلا قسم"]);if(!v.subject_id)issues.push([v.id,"زيارة بلا مادة"]);if(!v.observer_id)issues.push([v.id,"زيارة بلا مقيم"]);if(!v5CriteriaForVisit(v.id).length)issues.push([v.id,"زيارة بلا م1–م18"]);});teachers.forEach(t=>{if(!visits.some(v=>String(v.teacher_id)===String(t.id)))return;const cfg=v6ConfiguredSubjects(t);if(v6TeacherCoverageMode(t)!=="teacher_only"&&!cfg.length)issues.push([t.id,`المعلمة ${t.full_name}: لا توجد مواد مسندة معروفة`]);});return issues;}
function renderDataQuality(){v72InitCommon("qualityMonth");const month=$("qualityMonth")?.value||"",out=$("dataQualityOutput");if(!out)return;const issues=v72Quality(month);out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>سجل تدقيق جودة البيانات</h3><p>${esc(v5MonthLabel(month))}</p></div><div class="v5-kpis"><b>${issues.length}<small>ملاحظات تحتاج مراجعة</small></b></div></div><div class="table-wrap"><table><thead><tr><th>المرجع</th><th>الملاحظة</th></tr></thead><tbody>${issues.map(x=>`<tr><td>${esc(String(x[0]))}</td><td>${esc(x[1])}</td></tr>`).join('')||'<tr><td colspan="2">لا توجد ملاحظات آلية في النطاق.</td></tr>'}</tbody></table></div></article>`;}
function renderDecisionCenter(){v72InitCommon("decisionMonth","decisionDept");const month=$("decisionMonth")?.value||"",dept=$("decisionDept")?.value||"",out=$("decisionCenterOutput");if(!out)return;const raw=v7ScopeRows(month,dept),ts=dept?v61TeachersForDept(dept):teachers.filter(t=>visits.some(v=>String(v.teacher_id)===String(t.id))),items=ts.map(t=>v72PriorityFor(t,raw)),unvisited=items.filter(x=>!x.av.length),partial=items.filter(x=>x.cov.mode!=="teacher_only"&&x.cov.missing?.length),support=items.filter(x=>x.reasons.some(r=>/دعم|رعاية|تحقق/.test(r))),quality=v72Quality(month);out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>الملخص القيادي التنفيذي</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"كل المدرسة")}</p></div><div class="v5-kpis"><b>${unvisited.length}<small>لم تتم زيارتهن</small></b><b>${partial.length}<small>تغطية مواد جزئية</small></b><b>${support.length}<small>تحتاج تحقق/دعم</small></b><b>${quality.length}<small>ملاحظات جودة</small></b></div></div><h4>ما القرار المطلوب الآن؟</h4><div class="v5-priority-grid"><div><strong>استكمال التغطية</strong><b>${unvisited.length}</b><small>${esc(unvisited.slice(0,5).map(x=>x.t.full_name).join("، ")||"لا توجد")}</small></div><div><strong>تغطية مواد</strong><b>${partial.length}</b><small>${esc(partial.slice(0,5).map(x=>x.t.full_name).join("، ")||"لا توجد")}</small></div><div><strong>تحقق ودعم</strong><b>${support.length}</b><small>${esc(support.slice(0,5).map(x=>x.t.full_name).join("، ")||"لا توجد")}</small></div><div><strong>جودة البيانات</strong><b>${quality.length}</b><small>${quality.length?"تراجع قبل اعتماد التقرير":"لا توجد ملاحظات آلية"}</small></div></div><div class="analysis-note">هذه الشاشة تلخص القرار؛ التفاصيل موجودة في خطة الزيارات، مركز المتابعة، تحليل المواد، وجودة البيانات.</div></article>`;}

/* =========================================================
   STABLE CONSOLIDATION LAYER — 2026-10-08
   Preserves legacy screens; fixes relationship resolution, all-month scope,
   shared-visit counting, department aliases, leadership filters and source filters.
========================================================= */
function v8Norm(x){return v6Norm(x||"");}
function v8Profile(ref){
  const r=String(ref??"");
  return profiles.find(p=>[p.id,p.user_id,p.email].some(x=>x!=null&&String(x)===r)) ||
         profiles.find(p=>v8Norm(p.full_name||p.email)===v8Norm(r)) || null;
}
// All legacy code now benefits from user_id/id tolerant profile lookup.
function v5Profile(id){ return v8Profile(id); }

const V8_DEPT_MAP=[
  {keys:["امانه","أمانة","شوق","هبه","هبة"], dept:["الانجليزي","الإنجليزية","اللغة الإنجليزية"]},
  {keys:["فاطمه الحامد","فاطمة الحامد","عاليه","عالية","الاء","آلاء"], dept:["العربي","العربية والتربية الإسلامية","اللغة العربية والتربية الإسلامية"]},
  {keys:["اروي","أروى","نوره سعيد","نورة سعيد","جوري"], dept:["الرياضيات والعلوم"]},
  {keys:["حنان","مها بسيوني","هيفاء","دانه جمال","دانة جمال","شريفه الرويعي","شريفة الرويعي","ختام","فاطمه المطر","فاطمة المطر","نجود","لطيفه","لطيفة","نوره يحي","نورة يحي"], dept:["نظام فصل"]},
  {keys:["امال","آمال","مني الحلو","منى الحلو","مشاعل","مروه محمد صالح","مروة محمد صالح","مروه الحسيني","مروة الحسيني","نوال المراغي","فاطمه الرويعي","فاطمة الرويعي","فاطمه البشير","فاطمة البشير","نوال الحربي"], dept:["المواد الاثرائيه","المواد الإثرائية"]},
  {keys:["عبير الطيري"], dept:["الاجتماعيات والمواطنه","الاجتماعيات والمواطنة"]},
  {keys:["ساجده","ساجدة","مها الشمري","نوره الدوسري","نورة الدوسري"], dept:["التوحد"]},
  {keys:["زينب اسماعيل","زينب إسماعيل"], dept:["صعوبات التعلم"]},
  {keys:["ايمان عبدالرضا","إيمان عبدالرضا"], dept:["الدمج"]}
];
function v8AliasMatch(full,alias){const ft=new Set(v8Norm(full).split(" ").filter(Boolean)),at=v8Norm(alias).split(" ").filter(Boolean);return at.length&&at.every(x=>ft.has(x));}
function v8DeptIdForTeacher(t){
  const row=V8_DEPT_MAP.find(r=>r.keys.some(k=>v8AliasMatch(t?.full_name||"",k)));
  if(row){
    const d=departments.find(d=>row.dept.some(n=>v8Norm(d.name).includes(v8Norm(n))||v8Norm(n).includes(v8Norm(d.name))));
    if(d) return String(d.id);
  }
  if(t?.department_id!=null&&String(t.department_id)!=="") return String(t.department_id);
  const vr=visits.filter(v=>String(v.teacher_id)===String(t?.id)&&v.department_id!=null&&String(v.department_id)!=="")
    .sort((a,b)=>String(b.visit_date||"").localeCompare(String(a.visit_date||"")))[0];
  return vr?String(vr.department_id):"";
}
function v61TeacherDeptIds(t){const id=v8DeptIdForTeacher(t);return id?[id]:[];}
function v61TeacherDeptName(t,preferredDept=""){
  const id=v8DeptIdForTeacher(t); if(preferredDept&&String(preferredDept)===String(id))return v5DeptName(id);
  return id?v5DeptName(id):"غير محدد";
}
function v61TeachersForDept(dept){const all=activeRows(teachers);return !dept?all:all.filter(t=>String(v8DeptIdForTeacher(t))===String(dept));}

function v8VisitSubject(v){const s=v6VisitSubject(v);return s&&s!=="غير محدد"?s:"";}
function v8Compat(a,b){
  if(String(a.teacher_id)!==String(b.teacher_id))return false;
  if(String(a.visit_date||"").slice(0,10)!==String(b.visit_date||"").slice(0,10))return false;
  const fields=[[v8VisitSubject(a),v8VisitSubject(b)],[v7NormToken(a.grade_section||""),v7NormToken(b.grade_section||"")],[v7NormToken(a.period_name||""),v7NormToken(b.period_name||"")]];
  return fields.every(([x,y])=>!x||!y||x===y);
}
function v8Level(v){return leadershipLevel(v8Profile(v.observer_id));}
function v8ActualVisits(rows,{source="official"}={}){
  let r=(rows||[]).filter(v=>["قيادة عليا","قيادة وسطى"].includes(v8Level(v)));
  if(source==="upper")return r.filter(v=>v8Level(v)==="قيادة عليا").map(v=>({...v,_shared:false,_members:[v]}));
  if(source==="middle")return r.filter(v=>v8Level(v)==="قيادة وسطى").map(v=>({...v,_shared:false,_members:[v]}));
  // official/both: merge only cross-level observations that represent the same actual lesson.
  const used=new Set(),out=[];
  for(let i=0;i<r.length;i++){
    if(used.has(i))continue;
    const a=r[i], group=[a]; used.add(i);
    for(let j=i+1;j<r.length;j++){
      if(used.has(j))continue; const b=r[j];
      if(v8Level(a)!==v8Level(b)&&v8Compat(a,b)){group.push(b);used.add(j);}
    }
    const chosen=group.find(v=>v8Level(v)==="قيادة عليا")||group[0];
    out.push({...chosen,_shared:group.length>1,_members:group});
  }
  return out;
}
function v7ActualVisits(rows,{source="official",observerId=""}={}){
  if(observerId){
    const p=v8Profile(observerId); if(!p)return [];
    const own=(rows||[]).filter(v=>v8Profile(v.observer_id)===p || [p.id,p.user_id].filter(Boolean).map(String).includes(String(v.observer_id)));
    // personal report counts each actual lesson once for that member; shared metadata retained.
    const all=v8ActualVisits(rows,{source:"official"});
    return own.map(v=>{const shared=all.find(x=>(x._members||[]).includes(v));return shared?{...v,_shared:shared._shared,_members:shared._members}:{...v,_shared:false,_members:[v]};});
  }
  return v8ActualVisits(rows,{source});
}
function v5ApprovedVisits(rows){return v8ActualVisits(rows,{source:"official"});}
function v4AcceptedVisits(rows,source=v4AnalysisSource()){return v8ActualVisits(rows,{source:source==="all"?"both":source});}

function v8MonthValue(id){return $(id)?.value??"";}
function v8Scope(month,dept){
  return visits.filter(v=>(!month||monthKey(v.visit_date)===month)&&(!dept||String(v8DeptIdForTeacher(teachers.find(t=>String(t.id)===String(v.teacher_id))||{}))===String(dept)));
}
function v7ScopeRows(month,dept){return v8Scope(month,dept);}
function v5RowsForScope(month,dept){return v8Scope(month,dept);}

function v8Fill(id,items,placeholder,valueFn=x=>x,labelFn=x=>x){
  const el=$(id);if(!el)return;const old=el.value;
  el.innerHTML=`<option value="">${esc(placeholder)}</option>`+items.map(x=>`<option value="${esc(valueFn(x))}">${esc(labelFn(x))}</option>`).join("");
  if([...el.options].some(o=>o.value===old))el.value=old;
}
function v8InitFilters(){
  const months=availableMonths();
  ["leadershipMonthFilter","followupMonthFilter","dept360MonthFilter","subjectCoverageMonth","teacher360Month","matrixMonth","nextVisitsMonth","decisionMonth","qualityMonth"].forEach(id=>v8Fill(id,months,"كل الأشهر",x=>x,x=>v5MonthLabel(x)));
  ["leadershipDeptFilter","followupDeptFilter","subjectCoverageDept","matrixDept","nextVisitsDept","decisionDept"].forEach(id=>v8Fill(id,activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name));
  v8Fill("dept360Filter",activeRows(departments),"اختاري القسم",x=>x.id,x=>x.name);
  v8Fill("leadershipObserverFilter",v5LeadershipProfiles(),"اختاري عضو القيادة",x=>String(x.id??x.user_id??x.email),x=>`${x.full_name||x.email} — ${leadershipLevel(x)}`);
  v8Fill("teacher360Filter",activeRows(teachers),"اختاري المعلمة",x=>x.id,x=>x.full_name);
}
function renderLeadershipTracking(){
  v8InitFilters();const out=$("leadershipTrackingOutput");if(!out)return;
  const selected=$("leadershipObserverFilter")?.value||"",month=v8MonthValue("leadershipMonthFilter"),dept=$("leadershipDeptFilter")?.value||"",p=v8Profile(selected);
  if(!p){out.innerHTML='<article class="panel"><div class="empty-state">اختاري عضو القيادة لعرض سجل التغطية بالتفصيل.</div></article>';return;}
  const raw=v8Scope(month,dept),actual=v7ActualVisits(raw,{observerId:selected}),ts=v61TeachersForDept(dept),visited=new Set(actual.map(v=>String(v.teacher_id))),notVisited=ts.filter(t=>!visited.has(String(t.id)));
  const body=[...visited].map(id=>{const t=teachers.find(x=>String(x.id)===id),vs=actual.filter(v=>String(v.teacher_id)===id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date))),cov=t?v6TeacherSubjectCoverage(t,raw):null;return `<tr><td>${esc(t?.full_name||v5TeacherName(id))}</td><td>${esc(t?v61TeacherDeptName(t,dept):"غير محدد")}</td><td>${vs.map(v=>`${esc(formatDate(v.visit_date))} — ${esc(v7ActualSubject(v)||"غير محدد")} — ${esc(ratingLabel(v.overall_rating))}${v._shared?` — 👥 مشتركة (${v._members.map(m=>esc(v5ObserverName(m.observer_id))).join(" + ")})`:""}`).join("<br>")}</td><td>${cov?.mode==="teacher_only"?"متابعة بالمعلمة":esc(cov?.covered?.join("، ")||"—")}</td><td>${cov?.mode==="teacher_only"?"لا يطبق":esc(cov?.missing?.join("، ")||"لا يوجد")}</td></tr>`}).join("");
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تقرير متابعة زيارات ${esc(p.full_name||p.email||"")}</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p></div><div class="v5-kpis"><b>${actual.length}<small>زيارات فعلية</small></b><b>${visited.size}<small>معلمات تمت زيارتهن</small></b><b>${notVisited.length}<small>لم تتم زيارتهن</small></b></div></div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الزيارة / المادة / الحكم</th><th>المغطى</th><th>المتبقي</th></tr></thead><tbody>${body||'<tr><td colspan="5">لا توجد زيارات لهذا العضو في النطاق.</td></tr>'}</tbody></table></div><h4>لم تتم زيارتهن</h4><div class="v5-chip-list">${notVisited.map(t=>`<span>${esc(t.full_name)} • ${esc(v61TeacherDeptName(t,dept))}</span>`).join("")||"<span>اكتملت التغطية.</span>"}</div></article>`;
}
function renderTeacher360(){
  v8InitFilters();const out=$("teacher360Output"),tid=$("teacher360Filter")?.value||"",month=v8MonthValue("teacher360Month");if(!out)return;if(!tid){out.innerHTML='<article class="panel">اختاري المعلمة لعرض البطاقة.</article>';return;}
  const t=teachers.find(x=>String(x.id)===String(tid)),raw=visits.filter(v=>String(v.teacher_id)===String(tid)&&(!month||monthKey(v.visit_date)===month)),actual=v8ActualVisits(raw,{source:"official"}),cov=v6TeacherSubjectCoverage(t,raw),diag=v5TeacherDiagnosis(raw,tid);
  const timeline=actual.sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date))).map(v=>`<tr><td>${esc(formatDate(v.visit_date))}</td><td>${esc(v7ActualSubject(v)||"غير محدد")}</td><td>${esc(v5ObserverName(v.observer_id))}${v._shared?`<br><small>مشتركة: ${v._members.map(m=>esc(v5ObserverName(m.observer_id))).join(" + ")}</small>`:""}</td><td>${esc(ratingLabel(v.overall_rating))}</td></tr>`).join("");
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(t?.full_name||"")}</h3><p>${esc(v61TeacherDeptName(t))} • ${esc(v5MonthLabel(month))}</p></div><div class="v5-kpis"><b>${actual.length}<small>زيارات فعلية</small></b><b>${esc(v72Reliability(actual.length))}<small>موثوقية القراءة</small></b><b>${v5Badge(diag)}<small>الحالة</small></b><b>${v6CoverageBadge(cov)}<small>تغطية المواد</small></b></div></div><p><strong>المسندة:</strong> ${cov.mode==="teacher_only"?"متابعة بالمعلمة":esc(cov.configured.join("، ")||"—")} &nbsp; <strong>المغطاة:</strong> ${esc(cov.covered?.join("، ")||"—")} &nbsp; <strong>المتبقية:</strong> ${esc(cov.missing?.join("، ")||"—")}</p><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المادة</th><th>المقيم</th><th>الحكم</th></tr></thead><tbody>${timeline||'<tr><td colspan="4">لا توجد زيارات في النطاق.</td></tr>'}</tbody></table></div></article>`;
}

// Monthly/overall source filter without deleting legacy analysis.
const v8LegacyMonthlyScopeRows=monthlyScopeRows;
monthlyScopeRows = function(month){const r=v8LegacyMonthlyScopeRows(month),src=$("monthlyLeadershipSource")?.value||"official";return v8ActualVisits(r,{source:src});};
const v8LegacyOverallFilteredRows=overallFilteredRows;
overallFilteredRows = function(){const r=v8LegacyOverallFilteredRows(),src=$("overallLeadershipSource")?.value||"official";return v8ActualVisits(r,{source:src});};

// Preserve all-month choice and refresh the affected screen immediately.
document.addEventListener("change",e=>{
  const id=e.target?.id;
  if(id==="monthlyLeadershipSource")renderMonthly();
  if(id==="overallLeadershipSource")renderOverall();
  if(["leadershipObserverFilter","leadershipMonthFilter","leadershipDeptFilter"].includes(id))renderLeadershipTracking();
  if(["teacher360Filter","teacher360Month"].includes(id))renderTeacher360();
});

// Initialize stable selectors after data load/render cycle.
const v8OldRenderAll=renderAll;
renderAll = function(){v8OldRenderAll();v8InitFilters();};

/* =========================================================
   LEADERSHIP TRACKING HOTFIX 2 — 2026-10-08
   Resolve the visible selected leader robustly and match visits by the
   profile's real DB id/user_id. Does not mutate Supabase.
========================================================= */
function v9SelectedLeadershipProfile(){
  const el=$("leadershipObserverFilter");
  if(!el) return null;
  const value=String(el.value||"").trim();
  let p=v8Profile(value)||v71FindLeadershipProfile(value);
  if(p) return p;
  const label=String(el.selectedOptions?.[0]?.textContent||"").split("—")[0].trim();
  if(label){
    p=profiles.find(x=>v8Norm(x.full_name||x.email)===v8Norm(label)) ||
      profiles.find(x=>v8AliasMatch(x.full_name||x.email,label));
  }
  return p||null;
}
function v9EnsureLeadershipFilters(){
  const obs=$("leadershipObserverFilter");
  if(obs && obs.options.length<=1){
    v8Fill("leadershipObserverFilter",v5LeadershipProfiles(),"اختاري عضو القيادة",x=>String(x.id??x.user_id??x.email??x.full_name),x=>`${x.full_name||x.email} — ${leadershipLevel(x)}`);
  }
  const mon=$("leadershipMonthFilter");
  if(mon && mon.options.length<=1) v8Fill("leadershipMonthFilter",availableMonths(),"كل الأشهر",x=>x,x=>v5MonthLabel(x));
  const dep=$("leadershipDeptFilter");
  if(dep && dep.options.length<=1) v8Fill("leadershipDeptFilter",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name);
}
renderLeadershipTracking = function(){
  v9EnsureLeadershipFilters();
  const out=$("leadershipTrackingOutput"); if(!out)return;
  const p=v9SelectedLeadershipProfile();
  const month=$("leadershipMonthFilter")?.value||"";
  const dept=$("leadershipDeptFilter")?.value||"";
  if(!p){out.innerHTML='<article class="panel"><div class="empty-state">اختاري عضو القيادة لعرض سجل التغطية بالتفصيل.</div></article>';return;}
  const ids=new Set([p.id,p.user_id].filter(x=>x!=null&&String(x)!=="").map(String));
  const raw=v8Scope(month,dept);
  const ownRaw=raw.filter(v=>ids.has(String(v.observer_id)));
  // For each visit made by this leader, attach the cross-level shared visit metadata.
  const officialGroups=v8ActualVisits(raw,{source:"official"});
  const actual=[]; const seen=new Set();
  ownRaw.forEach(v=>{
    const shared=officialGroups.find(x=>(x._members||[]).some(m=>String(m.id)===String(v.id)));
    const key=shared?`g:${(shared._members||[]).map(m=>String(m.id)).sort().join("|")}`:`v:${v.id}`;
    if(seen.has(key)) return; seen.add(key);
    actual.push(shared?{...v,_shared:shared._shared,_members:shared._members}:{...v,_shared:false,_members:[v]});
  });
  const ts=v61TeachersForDept(dept);
  const visited=new Set(actual.map(v=>String(v.teacher_id)));
  const notVisited=ts.filter(t=>!visited.has(String(t.id)));
  const body=[...visited].map(id=>{
    const t=teachers.find(x=>String(x.id)===id);
    const vs=actual.filter(v=>String(v.teacher_id)===id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date)));
    const cov=t?v6TeacherSubjectCoverage(t,raw):null;
    return `<tr><td>${esc(t?.full_name||v5TeacherName(id))}</td><td>${esc(t?v61TeacherDeptName(t,dept):"غير محدد")}</td><td>${vs.map(v=>`${esc(formatDate(v.visit_date))} — ${esc(v7ActualSubject(v)||"غير محدد")} — ${esc(ratingLabel(v.overall_rating))}${v._shared?` — 👥 مشتركة (${v._members.map(m=>esc(v5ObserverName(m.observer_id))).join(" + ")})`:""}`).join("<br>")}</td><td>${cov?.mode==="teacher_only"?"متابعة بالمعلمة":esc(cov?.covered?.join("، ")||"—")}</td><td>${cov?.mode==="teacher_only"?"لا يطبق":esc(cov?.missing?.join("، ")||"لا يوجد")}</td></tr>`;
  }).join("");
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تقرير متابعة زيارات ${esc(p.full_name||p.email||"")}</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")} • ${esc(leadershipLevel(p))}</p></div><div class="v5-kpis"><b>${actual.length}<small>زيارات فعلية</small></b><b>${visited.size}<small>معلمات تمت زيارتهن</small></b><b>${notVisited.length}<small>لم تتم زيارتهن</small></b></div></div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الزيارة / المادة / الحكم</th><th>المغطى</th><th>المتبقي</th></tr></thead><tbody>${body||'<tr><td colspan="5">لا توجد زيارات لهذا العضو في النطاق المحدد.</td></tr>'}</tbody></table></div><h4>لم تتم زيارتهن</h4><div class="v5-chip-list">${notVisited.map(t=>`<span>${esc(t.full_name)} • ${esc(v61TeacherDeptName(t,dept))}</span>`).join("")||"<span>اكتملت التغطية.</span>"}</div><div class="analysis-note">تمت مطابقة عضو القيادة مع observer_id الحقيقي. الزيارة المشتركة تُعرض مرة واحدة في تقرير العضو مع الاحتفاظ بالمشاركين.</div></article>`;
};


/* =========================================================
   LEADERSHIP TRACKING HOTFIX 3 — selected-option authoritative
   The select option itself is authoritative even if profile lookup is late/empty.
========================================================= */
function v10LeadershipSelection(){
  const el=$("leadershipObserverFilter");
  if(!el) return null;
  const value=String(el.value||"").trim();
  if(!value) return null;
  const opt=el.selectedOptions?.[0];
  const text=String(opt?.textContent||"").trim();
  const name=text.split("—")[0].trim();
  const level=text.includes("قيادة وسطى")?"قيادة وسطى":text.includes("قيادة عليا")?"قيادة عليا":"";
  const profile=v8Profile(value)||v71FindLeadershipProfile(value)||profiles.find(x=>v8Norm(x.full_name||x.email)===v8Norm(name))||profiles.find(x=>v8AliasMatch(x.full_name||x.email,name))||null;
  const ids=new Set([value,profile?.id,profile?.user_id].filter(x=>x!=null&&String(x)!=="").map(String));
  return {value,name:name||profile?.full_name||profile?.email||"عضو القيادة",level:level||leadershipLevel(profile||{}),profile,ids};
}
function v10VisitBelongsToLeader(v,sel){
  if(sel.ids.has(String(v.observer_id))) return true;
  const vp=v8Profile(v.observer_id);
  if(!vp) return false;
  if(sel.profile && (vp===sel.profile || [sel.profile.id,sel.profile.user_id].filter(Boolean).map(String).includes(String(vp.id)) || [sel.profile.id,sel.profile.user_id].filter(Boolean).map(String).includes(String(vp.user_id)))) return true;
  const vn=vp.full_name||vp.email||"";
  return !!sel.name && (v8Norm(vn)===v8Norm(sel.name) || v8AliasMatch(vn,sel.name) || v8AliasMatch(sel.name,vn));
}
renderLeadershipTracking = function(){
  v9EnsureLeadershipFilters();
  const out=$("leadershipTrackingOutput"); if(!out)return;
  const sel=v10LeadershipSelection();
  const month=$("leadershipMonthFilter")?.value||"";
  const dept=$("leadershipDeptFilter")?.value||"";
  if(!sel){out.innerHTML='<article class="panel"><div class="empty-state">اختاري عضو القيادة لعرض سجل التغطية بالتفصيل.</div></article>';return;}
  const raw=v8Scope(month,dept);
  const ownRaw=raw.filter(v=>v10VisitBelongsToLeader(v,sel));
  const officialGroups=v8ActualVisits(raw,{source:"official"});
  const actual=[],seen=new Set();
  ownRaw.forEach(v=>{
    const shared=officialGroups.find(x=>(x._members||[]).some(m=>String(m.id)===String(v.id)));
    const key=shared?`g:${(shared._members||[]).map(m=>String(m.id)).sort().join("|")}`:`v:${v.id}`;
    if(seen.has(key))return;seen.add(key);
    actual.push(shared?{...v,_shared:shared._shared,_members:shared._members}:{...v,_shared:false,_members:[v]});
  });
  const ts=v61TeachersForDept(dept),visited=new Set(actual.map(v=>String(v.teacher_id))),notVisited=ts.filter(t=>!visited.has(String(t.id)));
  const body=[...visited].map(id=>{
    const t=teachers.find(x=>String(x.id)===id),vs=actual.filter(v=>String(v.teacher_id)===id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date))),cov=t?v6TeacherSubjectCoverage(t,raw):null;
    return `<tr><td>${esc(t?.full_name||v5TeacherName(id))}</td><td>${esc(t?v61TeacherDeptName(t,dept):"غير محدد")}</td><td>${vs.map(v=>`${esc(formatDate(v.visit_date))} — ${esc(v7ActualSubject(v)||"غير محدد")} — ${esc(ratingLabel(v.overall_rating))}${v._shared?` — 👥 مشتركة (${v._members.map(m=>esc(v5ObserverName(m.observer_id))).join(" + ")})`:""}`).join("<br>")}</td><td>${cov?.mode==="teacher_only"?"متابعة بالمعلمة":esc(cov?.covered?.join("، ")||"—")}</td><td>${cov?.mode==="teacher_only"?"لا يطبق":esc(cov?.missing?.join("، ")||"لا يوجد")}</td></tr>`;
  }).join("");
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تقرير متابعة زيارات ${esc(sel.name)}</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")} • ${esc(sel.level||"")}</p></div><div class="v5-kpis"><b>${actual.length}<small>زيارات فعلية</small></b><b>${visited.size}<small>معلمات تمت زيارتهن</small></b><b>${notVisited.length}<small>لم تتم زيارتهن</small></b></div></div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الزيارة / المادة / الحكم</th><th>المغطى</th><th>المتبقي</th></tr></thead><tbody>${body||'<tr><td colspan="5">لا توجد زيارات لهذا العضو في النطاق المحدد.</td></tr>'}</tbody></table></div><h4>لم تتم زيارتهن</h4><div class="v5-chip-list">${notVisited.map(t=>`<span>${esc(t.full_name)} • ${esc(v61TeacherDeptName(t,dept))}</span>`).join("")||"<span>اكتملت التغطية.</span>"}</div><div class="analysis-note">مصدر اختيار عضو القيادة هو الخيار المحدد نفسه؛ ثم تتم مطابقة observer_id بالمعرّف والملف والاسم. الزيارة المشتركة تظهر مرة واحدة.</div></article>`;
};

/* =========================================================
   LEADERSHIP TRACKING HOTFIX 4 — deterministic UI refresh
   The visible selection is authoritative and all three controls
   refresh the report immediately. No Supabase mutation.
========================================================= */
function v11LeadershipSelection(){
  const el=$("leadershipObserverFilter");
  if(!el) return null;
  const value=String(el.value||"").trim();
  const opt=el.options?.[el.selectedIndex];
  if(!value || !opt) return null;
  const label=String(opt.textContent||"").trim();
  const name=label.split("—")[0].trim();
  const level=label.includes("قيادة وسطى")?"قيادة وسطى":label.includes("قيادة عليا")?"قيادة عليا":"";
  const profile=profiles.find(p=>String(p.id??"")===value)||profiles.find(p=>String(p.user_id??"")===value)||profiles.find(p=>v8Norm(p.full_name||p.email)===v8Norm(name))||null;
  const ids=new Set([value,profile?.id,profile?.user_id].filter(x=>x!=null&&String(x)!=="").map(String));
  return {value,name:name||profile?.full_name||profile?.email||label,level:level||leadershipLevel(profile||{}),profile,ids};
}
function v11LeaderOwnRows(raw,sel){
  return (raw||[]).filter(v=>{
    if(sel.ids.has(String(v.observer_id))) return true;
    const vp=v8Profile(v.observer_id);
    if(!vp) return false;
    if([vp.id,vp.user_id].filter(x=>x!=null).map(String).some(id=>sel.ids.has(id))) return true;
    const n=vp.full_name||vp.email||"";
    return !!sel.name && v8Norm(n)===v8Norm(sel.name);
  });
}
renderLeadershipTracking = function(){
  v9EnsureLeadershipFilters();
  const out=$("leadershipTrackingOutput"); if(!out)return;
  const sel=v11LeadershipSelection();
  const month=$("leadershipMonthFilter")?.value||"";
  const dept=$("leadershipDeptFilter")?.value||"";
  if(!sel){out.innerHTML='<article class="panel"><div class="empty-state">اختاري عضو القيادة لعرض سجل التغطية بالتفصيل.</div></article>';return;}
  const raw=v8Scope(month,dept);
  const ownRaw=v11LeaderOwnRows(raw,sel);
  const officialGroups=v8ActualVisits(raw,{source:"official"});
  const actual=[],seen=new Set();
  for(const v of ownRaw){
    const shared=officialGroups.find(x=>(x._members||[]).some(m=>String(m.id)===String(v.id)));
    const key=shared?`g:${(shared._members||[]).map(m=>String(m.id)).sort().join("|")}`:`v:${v.id}`;
    if(seen.has(key))continue; seen.add(key);
    actual.push(shared?{...v,_shared:!!shared._shared,_members:shared._members}:{...v,_shared:false,_members:[v]});
  }
  const ts=v61TeachersForDept(dept),visited=new Set(actual.map(v=>String(v.teacher_id))),notVisited=ts.filter(t=>!visited.has(String(t.id)));
  const body=[...visited].map(id=>{
    const t=teachers.find(x=>String(x.id)===id),vs=actual.filter(v=>String(v.teacher_id)===id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date))),cov=t?v6TeacherSubjectCoverage(t,raw):null;
    return `<tr><td>${esc(t?.full_name||v5TeacherName(id))}</td><td>${esc(t?v61TeacherDeptName(t,dept):"غير محدد")}</td><td>${vs.map(v=>`${esc(formatDate(v.visit_date))} — ${esc(v7ActualSubject(v)||"غير محدد")} — ${esc(ratingLabel(v.overall_rating))}${v._shared?` — 👥 مشتركة (${v._members.map(m=>esc(v5ObserverName(m.observer_id))).join(" + ")})`:""}`).join("<br>")}</td><td>${cov?.mode==="teacher_only"?"متابعة بالمعلمة":esc(cov?.covered?.join("، ")||"—")}</td><td>${cov?.mode==="teacher_only"?"لا يطبق":esc(cov?.missing?.join("، ")||"لا يوجد")}</td></tr>`;
  }).join("");
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تقرير متابعة زيارات ${esc(sel.name)}</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")} • ${esc(sel.level||"")}</p></div><div class="v5-kpis"><b>${actual.length}<small>زيارات فعلية</small></b><b>${visited.size}<small>معلمات تمت زيارتهن</small></b><b>${notVisited.length}<small>لم تتم زيارتهن</small></b></div></div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الزيارة / المادة / الحكم</th><th>المغطى</th><th>المتبقي</th></tr></thead><tbody>${body||'<tr><td colspan="5">لا توجد زيارات لهذا العضو في النطاق المحدد.</td></tr>'}</tbody></table></div><h4>لم تتم زيارتهن</h4><div class="v5-chip-list">${notVisited.map(t=>`<span>${esc(t.full_name)} • ${esc(v61TeacherDeptName(t,dept))}</span>`).join("")||"<span>اكتملت التغطية.</span>"}</div><div class="analysis-note">عضو القيادة المحدد: <strong>${esc(sel.name)}</strong>. الزيارة المشتركة تُحسب مرة واحدة مع الاحتفاظ بالمشاركين.</div></article>`;
};

// Also bind after data has loaded; onchange attributes remain as a deterministic fallback.
document.addEventListener("change",function(e){
  if(["leadershipObserverFilter","leadershipMonthFilter","leadershipDeptFilter"].includes(e.target?.id)) renderLeadershipTracking();
});

/* =========================================================
   LEADERSHIP TRACKING FIX 5 — VERIFIED DB LINKAGE
   Supabase schema verified 2026-10-08:
   visits.observer_id === profiles.id (UUID).
   The selected <option>.value is therefore used directly as observer_id.
   No profile/user_id inference is required for loading the member's visits.
========================================================= */
function v12LeadershipSelection(){
  const el=$("leadershipObserverFilter");
  if(!el) return null;
  const observerId=String(el.value||"").trim();
  if(!observerId) return null;
  const opt=el.options?.[el.selectedIndex];
  const label=String(opt?.textContent||"").trim();
  const name=(label.split("—")[0]||"").trim();
  const profile=profiles.find(p=>String(p.id)===observerId)||null;
  return {
    observerId,
    profile,
    name:name||profile?.full_name||profile?.email||"عضو القيادة",
    level:leadershipLevel(profile||{}) || (label.includes("قيادة وسطى")?"قيادة وسطى":label.includes("قيادة عليا")?"قيادة عليا":"")
  };
}

function v12LeadershipActualRows(raw,observerId){
  // DB-authoritative match: visits.observer_id -> profiles.id.
  const own=(raw||[]).filter(v=>String(v.observer_id)===String(observerId));
  const allGroups=v7VisitGroups((raw||[]).filter(v=>["قيادة عليا","قيادة وسطى"].includes(leadershipLevel(v5Profile(v.observer_id)))));
  const result=[];
  const seen=new Set();
  for(const v of own){
    const group=allGroups.find(g=>g.some(m=>String(m.id)===String(v.id))) || [v];
    const key=group.map(m=>String(m.id)).sort().join("|");
    if(seen.has(key)) continue;
    seen.add(key);
    result.push({...v,_shared:group.length>1,_members:group,_actualKey:v7ActualVisitKey(v)});
  }
  return result;
}

renderLeadershipTracking = function(){
  // Never rebuild a populated selector here: doing so can erase the user's
  // live selection during onchange. Populate only if the controls are empty.
  v9EnsureLeadershipFilters();
  const out=$("leadershipTrackingOutput"); if(!out) return;
  const sel=v12LeadershipSelection();
  const month=$("leadershipMonthFilter")?.value||"";
  const dept=$("leadershipDeptFilter")?.value||"";
  if(!sel){
    out.innerHTML='<article class="panel"><div class="empty-state">اختاري عضو القيادة لعرض سجل التغطية بالتفصيل.</div></article>';
    return;
  }

  const raw=v8Scope(month,dept);
  const actual=v12LeadershipActualRows(raw,sel.observerId);
  const ts=v61TeachersForDept(dept);
  const visited=new Set(actual.map(v=>String(v.teacher_id)));
  const notVisited=ts.filter(t=>!visited.has(String(t.id)));

  const body=[...visited].map(id=>{
    const t=teachers.find(x=>String(x.id)===id);
    const vs=actual.filter(v=>String(v.teacher_id)===id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date)));
    const cov=t?v6TeacherSubjectCoverage(t,raw):null;
    return `<tr>
      <td>${esc(t?.full_name||v5TeacherName(id))}</td>
      <td>${esc(t?v61TeacherDeptName(t,dept):v5DeptName(vs[0]?.department_id))}</td>
      <td>${vs.map(v=>`${esc(formatDate(v.visit_date))} — <strong>${esc(v7ActualSubject(v)||"غير محدد")}</strong> — ${esc(ratingLabel(v.overall_rating))}${v._shared?` — 👥 مشتركة (${v._members.map(m=>esc(v5ObserverName(m.observer_id))).join(" + ")})`:""}`).join("<br>")}</td>
      <td>${cov?.mode==="teacher_only"?"متابعة بالمعلمة":esc(cov?.covered?.join("، ")||"—")}</td>
      <td>${cov?.mode==="teacher_only"?"لا يطبق":esc(cov?.missing?.join("، ")||"لا يوجد")}</td>
    </tr>`;
  }).join("");

  const partial=ts.filter(t=>visited.has(String(t.id)) && v6TeacherCoverageMode(t)==="subject_based" && v6TeacherSubjectCoverage(t,raw).missing.length);
  const monthText=v5MonthLabel(month);
  out.innerHTML=`<article class="panel v5-report">
    <div class="v5-report-head"><div>
      <h3>تقرير متابعة زيارات ${esc(sel.name)}</h3>
      <p>${esc(monthText)} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")} • ${esc(sel.level||"")}</p>
    </div><div class="v5-kpis">
      <b>${actual.length}<small>زيارات فعلية</small></b>
      <b>${visited.size}<small>معلمات تمت زيارتهن</small></b>
      <b>${notVisited.length}<small>لم تتم زيارتهن</small></b>
      <b>${partial.length}<small>زارتهن وبقيت مواد</small></b>
    </div></div>
    <h4>تمت زيارتهن — المادة والحكم</h4>
    <div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الزيارة / المادة / الحكم</th><th>المغطى</th><th>المتبقي</th></tr></thead><tbody>${body||'<tr><td colspan="5">لا توجد زيارات لهذا العضو في النطاق المحدد.</td></tr>'}</tbody></table></div>
    <h4>لم تتم زيارتهن في ${esc(monthText)}</h4>
    <div class="v5-chip-list">${notVisited.map(t=>`<span>${esc(t.full_name)} • ${esc(v61TeacherDeptName(t,dept))}</span>`).join("")||"<span>اكتملت تغطية المعلمات ضمن النطاق.</span>"}</div>
    <div class="analysis-note">الربط المعتمد: <strong>visits.observer_id = profiles.id</strong>. الزيارة المشتركة تُحسب مرة واحدة، ويظهر المشاركون دون مضاعفة الزيارة.</div>
  </article>`;
};

/* =========================================================
   FOLLOW-UP CENTER — VISIT / EVALUATOR TRANSPARENCY
   Adds actual visit count and evaluator details to every teacher.
   Shared visits count once and list all participating evaluators.
========================================================= */
function v13FollowupVisitDetails(raw, teacherId){
  const actual=v7ActualVisits((raw||[]).filter(v=>String(v.teacher_id)===String(teacherId)),{source:"official"})
    .slice().sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date)));
  const evaluatorCounts={};
  actual.forEach(v=>{
    const members=(v._shared && Array.isArray(v._members) && v._members.length)?v._members:[v];
    members.forEach(m=>{
      const name=v5ObserverName(m.observer_id)||"مقيم غير محدد";
      evaluatorCounts[name]=(evaluatorCounts[name]||0)+1;
    });
  });
  const countText=Object.entries(evaluatorCounts)
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"ar"))
    .map(([name,n])=>`${esc(name)}: ${n}`)
    .join(" • ") || "—";
  const detail=actual.map(v=>{
    const members=(v._shared && Array.isArray(v._members) && v._members.length)?v._members:[v];
    const names=members.map(m=>v5ObserverName(m.observer_id)||"مقيم غير محدد");
    const evaluator=v._shared?`👥 مشتركة: ${names.map(esc).join(" + ")}`:esc(names[0]);
    const official=v._shared?` <small>— الحكم الرسمي: ${esc(v5ObserverName(v.observer_id)||names[0])}</small>`:"";
    return `<div class="v13-visit-line"><strong>${esc(formatDate(v.visit_date))}</strong> — ${evaluator} — ${esc(v7ActualSubject(v)||"غير محدد")} — ${esc(ratingLabel(v.overall_rating))}${official}</div>`;
  }).join("") || "—";
  return {actual,countText,detail};
}

renderFollowupCenter = function(){
  v7EnsureFilterOptions();
  const out=$("followupCenterOutput"); if(!out)return;
  const month=$("followupMonthFilter")?.value||availableMonths()[0]||"";
  const dept=$("followupDeptFilter")?.value||"";
  const raw=v7ScopeRows(month,dept);
  const ts=v61TeachersForDept(dept);
  const list=ts.map(t=>({t,d:v5TeacherDiagnosis(raw,t.id),v:v13FollowupVisitDetails(raw,t.id)}))
    .filter(x=>x.d.key!=="stable")
    .sort((a,b)=>b.d.score-a.d.score||a.t.full_name.localeCompare(b.t.full_name,"ar"));
  const count=k=>list.filter(x=>x.d.key===k).length;
  const decision=d=>d.key==="priority"?"دعم مستهدف + إعادة رصد":d.key==="targeted"?"تدخل مهني موجه":d.key==="verify"?"زيارة مستقلة للتحقق":d.key==="initial"?"استكمال الرصد":"جدولة زيارة";
  out.innerHTML=`<article class="panel v5-report">
    <div class="v5-report-head"><div>
      <h3>الحالات التي تحتاج إجراء — ${esc(v5MonthLabel(month))}</h3>
      <p>${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p>
    </div><div class="v5-kpis">
      <b>${count("priority")}<small>أولى بالرعاية</small></b>
      <b>${count("targeted")}<small>دعم مستهدف</small></b>
      <b>${count("verify")}<small>تحقق</small></b>
      <b>${count("initial")}<small>قراءة أولية</small></b>
      <b>${count("unvisited")}<small>لم تتم الزيارة</small></b>
    </div></div>
    <div class="table-wrap"><table><thead><tr>
      <th>المعلمة</th><th>القسم</th><th>الزيارات الفعلية</th><th>عدد الزيارات باسم المقيم</th><th>تفاصيل المقيم / الزيارة / الحكم</th><th>الحالة</th><th>لماذا؟</th><th>القرار المقترح</th>
    </tr></thead><tbody>${list.map(({t,d,v})=>`<tr>
      <td>${esc(t.full_name)}</td>
      <td>${esc(v7TeacherDeptLabel(t,dept))}</td>
      <td><strong>${v.actual.length}</strong></td>
      <td>${v.countText}</td>
      <td>${v.detail}</td>
      <td>${v5Badge(d)}</td>
      <td>${esc(d.reason)}</td>
      <td>${decision(d)}</td>
    </tr>`).join("")||`<tr><td colspan="8">لا توجد حالات متابعة.</td></tr>`}</tbody></table></div>
    <div class="analysis-note"><strong>طريقة القراءة:</strong> «دعم مستهدف» يعني وجود مؤشرات جزئية في أكثر من معيار دون تكرار مستقل لنفس المعيار، أما «أولى بالرعاية» فتتطلب تكرار التقييم الجزئي لنفس المعيار عبر زيارات فعلية مستقلة. الزيارة المشتركة تُحسب زيارة فعلية واحدة، ويظهر جميع المقيمين المشاركين فيها، بينما يعتمد الحكم الرسمي على القيادة العليا عند وجودها.</div>
  </article>`;
};

/* =========================================================
   ALL-MONTHS LONGITUDINAL FIX — 2026-10-10
   Blank month means ALL months everywhere. Never falls back to latest month.
   In longitudinal views, show monthly visit count + status so progress is visible.
========================================================= */
function v14SelectedMonth(id){
  const el=$(id); return el ? String(el.value ?? "") : "";
}
function v14MonthsInRows(rows){
  return [...new Set((rows||[]).map(v=>monthKey(v.visit_date)).filter(Boolean))].sort();
}
function v14TeacherMonthly(raw, teacherId){
  return v14MonthsInRows(raw).map(m=>{
    const mr=(raw||[]).filter(v=>monthKey(v.visit_date)===m && String(v.teacher_id)===String(teacherId));
    const av=v7ActualVisits(mr,{source:"official"});
    const d=v5TeacherDiagnosis(mr,teacherId);
    return {month:m,count:av.length,diag:d};
  }).filter(x=>x.count>0);
}
function v14MonthlyCell(raw,teacherId){
  const items=v14TeacherMonthly(raw,teacherId);
  return items.length?items.map(x=>`<div><strong>${esc(v5MonthLabel(x.month))}:</strong> ${x.count} زيارة — ${v5Badge(x.diag)}</div>`).join(""):"—";
}
function v14Trend(raw,teacherId){
  const a=v14TeacherMonthly(raw,teacherId); if(a.length<2)return "لا توجد مقارنة شهرية كافية";
  const first=a[0],last=a[a.length-1];
  if(last.diag.score<first.diag.score)return `تحسن: ${first.diag.label} ← ${last.diag.label}`;
  if(last.diag.score>first.diag.score)return `يحتاج متابعة: ${first.diag.label} ← ${last.diag.label}`;
  return `مستمر: ${last.diag.label}`;
}

renderFollowupCenter = function(){
  v7EnsureFilterOptions(); const out=$("followupCenterOutput"); if(!out)return;
  const month=v14SelectedMonth("followupMonthFilter"), dept=$("followupDeptFilter")?.value||"";
  const raw=v7ScopeRows(month,dept), ts=v61TeachersForDept(dept);
  const list=ts.map(t=>({t,d:v5TeacherDiagnosis(raw,t.id),v:v13FollowupVisitDetails(raw,t.id)}))
    .filter(x=>x.d.key!=="stable").sort((a,b)=>b.d.score-a.d.score||a.t.full_name.localeCompare(b.t.full_name,"ar"));
  const count=k=>list.filter(x=>x.d.key===k).length;
  const decision=d=>d.key==="priority"?"دعم مستهدف + إعادة رصد":d.key==="targeted"?"تدخل مهني موجه":d.key==="verify"?"زيارة مستقلة للتحقق":d.key==="initial"?"استكمال الرصد":"جدولة زيارة";
  const longitudinal=!month;
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>${longitudinal?"المتابعة التراكمية لكل الأشهر":`الحالات التي تحتاج إجراء — ${esc(v5MonthLabel(month))}`}</h3><p>${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p></div><div class="v5-kpis"><b>${count("priority")}<small>أولى بالرعاية</small></b><b>${count("targeted")}<small>دعم مستهدف</small></b><b>${count("verify")}<small>تحقق</small></b><b>${count("initial")}<small>قراءة أولية</small></b><b>${count("unvisited")}<small>لم تتم الزيارة</small></b></div></div>
  <div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>إجمالي الزيارات الفعلية</th>${longitudinal?"<th>التطور حسب الشهر</th><th>قراءة التطور</th>":""}<th>عدد الزيارات باسم المقيم</th><th>تفاصيل المقيم / الزيارة / الحكم</th><th>الحالة الحالية</th><th>لماذا؟</th><th>القرار المقترح</th></tr></thead><tbody>${list.map(({t,d,v})=>`<tr><td>${esc(t.full_name)}</td><td>${esc(v7TeacherDeptLabel(t,dept))}</td><td><strong>${v.actual.length}</strong></td>${longitudinal?`<td>${v14MonthlyCell(raw,t.id)}</td><td>${esc(v14Trend(raw,t.id))}</td>`:""}<td>${v.countText}</td><td>${v.detail}</td><td>${v5Badge(d)}</td><td>${esc(d.reason)}</td><td>${decision(d)}</td></tr>`).join("")||`<tr><td colspan="${longitudinal?10:8}">لا توجد حالات متابعة.</td></tr>`}</tbody></table></div>
  <div class="analysis-note">${longitudinal?"كل الأشهر = نطاق تراكمي حقيقي، مع فصل نتيجة كل شهر حتى لا تختلط حالة سبتمبر بأكتوبر.":"النتيجة تخص الشهر المحدد فقط."} الزيارة المشتركة تُحسب مرة واحدة ويظهر جميع المقيمين.</div></article>`;
};

renderDepartment360 = function(){
  v7EnsureFilterOptions(); const out=$("department360Output"); if(!out)return;
  const dept=$("dept360Filter")?.value||"", month=v14SelectedMonth("dept360MonthFilter");
  if(!dept){out.innerHTML='<article class="panel"><div class="empty-state">اختاري القسم لعرض تحليل 360°.</div></article>';return;}
  const raw=v7ScopeRows(month,dept), actual=v7ActualVisits(raw,{source:"official"}), ts=v61TeachersForDept(dept), visited=new Set(actual.map(v=>String(v.teacher_id))), longitudinal=!month;
  const diag=ts.map(t=>({t,d:v5TeacherDiagnosis(raw,t.id),n:actual.filter(v=>String(v.teacher_id)===String(t.id)).length,c:v6TeacherSubjectCoverage(t,raw)}));
  const stats={}; actual.forEach(v=>v5CriteriaForVisit(v.id).forEach(r=>{const c=String(r.criterion_no);(stats[c]||={total:0,partial:0});stats[c].total++;if(num(r.rating)===1)stats[c].partial++;}));
  const priorities=Object.entries(stats).sort((a,b)=>pct(b[1].partial,b[1].total)-pct(a[1].partial,a[1].total)).slice(0,5);
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(v5DeptName(dept))} — تحليل 360°</h3><p>${esc(v5MonthLabel(month))}</p></div><div class="v5-kpis"><b>${ts.length}<small>معلمات القسم</small></b><b>${visited.size}<small>تمت زيارتهن</small></b><b>${actual.length}<small>زيارات فعلية معتمدة</small></b><b>${pct(visited.size,ts.length)}%<small>تغطية القسم</small></b></div></div><h4>المعلمات وقراءة المتابعة</h4><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>${longitudinal?"إجمالي الزيارات":"زيارات فعلية"}</th>${longitudinal?"<th>الزيارات والحالة حسب الشهر</th><th>التطور</th>":""}<th>الحالة</th><th>تغطية المادة</th><th>المعايير الجزئية</th><th>القراءة</th></tr></thead><tbody>${diag.map(({t,d,n,c})=>`<tr><td>${esc(t.full_name)}</td><td>${n}</td>${longitudinal?`<td>${v14MonthlyCell(raw,t.id)}</td><td>${esc(v14Trend(raw,t.id))}</td>`:""}<td>${v5Badge(d)}</td><td>${v6CoverageBadge(c)}</td><td>${d.partial.length?`م${d.partial.join("، م")}`:"—"}</td><td>${esc(d.reason)}</td></tr>`).join("")||`<tr><td colspan="${longitudinal?8:6}">لا توجد معلمات مرتبطة بالقسم.</td></tr>`}</tbody></table></div><h4>أعلى أولويات المعايير داخل القسم</h4><div class="v5-priority-grid">${priorities.map(([c,x])=>`<div><strong>م${c}</strong><b>${pct(x.partial,x.total)}%</b><small>يفي جزئيًا • ${x.partial}/${x.total} رصدًا</small></div>`).join("")||"لا توجد بيانات معايير كافية"}</div><div class="analysis-note">${longitudinal?"تم جمع كل الأشهر مع إظهار حالة كل شهر منفصلة لقراءة التحسن أو الاستمرار.":"التحليل خاص بالشهر المحدد."}</div></article>`;
};

renderSubjectCoverage = function(){
  const out=$("subjectCoverageOutput");if(!out)return;v6PrepareSubjectFilters();
  const month=v14SelectedMonth("subjectCoverageMonth"),dept=$("subjectCoverageDept")?.value||"",chosen=$("subjectCoverageSubject")?.value||"",ts=v61TeachersForDept(dept),raw=v7ScopeRows(month,dept),coverage=ts.map(t=>({t,c:v6TeacherSubjectCoverage(t,raw)})),subjectBased=coverage.filter(x=>x.c.mode==="subject_based"&&x.c.configured.length),special=coverage.filter(x=>x.c.mode==="teacher_only"),slots=subjectBased.reduce((n,x)=>n+x.c.configured.length,0),coveredSlots=subjectBased.reduce((n,x)=>n+x.c.covered.length,0),teacherVisited=coverage.filter(x=>x.c.visitCount>0).length,allSubjects=v6AllConfiguredSubjects(ts),subject=chosen&&allSubjects.includes(chosen)?chosen:(allSubjects[0]||"");if($("subjectCoverageSubject")&&subject)$("subjectCoverageSubject").value=subject;const ss=subject?v6SubjectStats(raw,subject):{rows:[],teachers:new Set(),priority:[]},target=ts.filter(t=>v6ConfiguredSubjects(t).includes(subject)),subjectPct=pct(target.filter(t=>ss.teachers.has(String(t.id))).length,target.length),longitudinal=!month;
  const rows=coverage.map(({t,c})=>`<tr><td>${esc(t.full_name)}</td><td>${esc(v61TeacherDeptName(t,dept))}</td><td>${v6CoverageBadge(c)}</td><td>${c.mode==="teacher_only"?"تمت زيارة المعلمة":esc(c.covered.join("، ")||"—")}</td><td>${c.mode==="teacher_only"?"لا يطبق تحليل المواد":esc(c.missing.join("، ")||"لا يوجد")}</td><td>${c.visitCount}</td>${longitudinal?`<td>${v14MonthlyCell(raw,t.id)}</td>`:""}</tr>`).join("");
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>تحليل المواد والتغطية</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p></div><div class="v5-kpis"><b>${teacherVisited}<small>معلمات تمت زيارتهن</small></b><b>${coveredSlots}/${slots}<small>مواد مغطاة/مسندة</small></b><b>${special.length}<small>متابعة بالمعلمة</small></b><b>${subjectPct}%<small>تغطية ${esc(subject||"المادة")}</small></b></div></div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الحالة</th><th>تمت تغطيته</th><th>المتبقي</th><th>الزيارات الفعلية</th>${longitudinal?"<th>التغطية/الحالة حسب الشهر</th>":""}</tr></thead><tbody>${rows||`<tr><td colspan="${longitudinal?7:6}">لا توجد بيانات.</td></tr>`}</tbody></table></div><div class="analysis-note">${longitudinal?"في خيار كل الأشهر تُحسب التغطية على كامل الفترة، ويظهر بجانب كل معلمة تفصيل الزيارات والحالة شهريًا.":"التغطية محسوبة داخل الشهر المحدد."}</div></article>`;
};

renderTeacher360 = function(){
  v8InitFilters();const out=$("teacher360Output"),tid=$("teacher360Filter")?.value||"",month=v14SelectedMonth("teacher360Month");if(!out)return;if(!tid){out.innerHTML='<article class="panel">اختاري المعلمة لعرض البطاقة.</article>';return;}
  const t=teachers.find(x=>String(x.id)===String(tid)),raw=visits.filter(v=>String(v.teacher_id)===String(tid)&&(!month||monthKey(v.visit_date)===month)),actual=v8ActualVisits(raw,{source:"official"}),cov=v6TeacherSubjectCoverage(t,raw),diag=v5TeacherDiagnosis(raw,tid),longitudinal=!month;
  const timeline=actual.sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date))).map(v=>`<tr><td>${esc(formatDate(v.visit_date))}</td><td>${esc(v7ActualSubject(v)||"غير محدد")}</td><td>${esc(v5ObserverName(v.observer_id))}${v._shared?`<br><small>مشتركة: ${v._members.map(m=>esc(v5ObserverName(m.observer_id))).join(" + ")}</small>`:""}</td><td>${esc(ratingLabel(v.overall_rating))}</td></tr>`).join("");
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(t?.full_name||"")}</h3><p>${esc(v61TeacherDeptName(t))} • ${esc(v5MonthLabel(month))}</p></div><div class="v5-kpis"><b>${actual.length}<small>زيارات فعلية</small></b><b>${esc(v72Reliability(actual.length))}<small>موثوقية القراءة</small></b><b>${v5Badge(diag)}<small>الحالة</small></b><b>${v6CoverageBadge(cov)}<small>تغطية المواد</small></b></div></div>${longitudinal?`<h4>التطور الشهري</h4><div class="analysis-note">${v14MonthlyCell(raw,tid)}<br><strong>${esc(v14Trend(raw,tid))}</strong></div>`:""}<p><strong>المسندة:</strong> ${cov.mode==="teacher_only"?"متابعة بالمعلمة":esc(cov.configured.join("، ")||"—")} &nbsp; <strong>المغطاة:</strong> ${esc(cov.covered?.join("، ")||"—")} &nbsp; <strong>المتبقية:</strong> ${esc(cov.missing?.join("، ")||"—")}</p><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المادة</th><th>المقيم</th><th>الحكم</th></tr></thead><tbody>${timeline||'<tr><td colspan="4">لا توجد زيارات في النطاق.</td></tr>'}</tbody></table></div></article>`;
};

// Keep the blank "all months" value untouched and refresh every analytical screen that has a month selector.
document.addEventListener("change",function(e){
  const id=e.target?.id;
  if(id==="followupMonthFilter")renderFollowupCenter();
  if(["dept360MonthFilter","dept360Filter"].includes(id))renderDepartment360();
  if(["subjectCoverageMonth","subjectCoverageDept","subjectCoverageSubject"].includes(id))renderSubjectCoverage();
  if(["teacher360Month","teacher360Filter"].includes(id))renderTeacher360();
});

/* =========================================================
   CENTRAL DATA RESOLUTION + QUALITY AUDIT PATCH — 2026-10-10
   One resolver for visit subject; audit raw gaps without hiding them.
========================================================= */
function v14RawVisitSubject(v){
  const s=v6SubjectNameById(v?.subject_id);
  return s && s!=="غير محدد" ? s : "";
}
function v14TeacherForVisit(v){
  return teachers.find(t=>String(t.id)===String(v?.teacher_id)) || null;
}
function v14AssignedSubjectsForVisit(v){
  const t=v14TeacherForVisit(v);
  if(!t || v6TeacherCoverageMode(t)==="teacher_only") return [];
  return (v6ConfiguredSubjects(t)||[]).filter(x=>x && x!=="غير محدد");
}
// Central subject resolver used by all downstream screens that call v7ActualSubject.
// Priority: raw visit subject -> subject on shared member -> teacher assignment(s) -> undefined.
function v7ActualSubject(v){
  let s=v14RawVisitSubject(v);
  if(s) return s;
  for(const m of (v?._members||[])){
    s=v14RawVisitSubject(m);
    if(s) return s;
  }
  const assigned=v14AssignedSubjectsForVisit(v);
  if(assigned.length===1) return assigned[0];
  if(assigned.length>1) return assigned.join(" / ");
  return "غير محدد";
}
function v14VisitDept(v){
  if(v?.department_id && maps().departments[String(v.department_id)]) return v5DeptName(v.department_id);
  const t=v14TeacherForVisit(v);
  if(t){
    const ids=v61TeacherDeptIds(t);
    if(ids.length) return ids.map(v5DeptName).filter(x=>x&&x!=="غير محدد").join(" / ") || "غير محدد";
  }
  return "غير محدد";
}
function v14QualityRows(month){
  const raw=visits.filter(v=>!month||monthKey(v.visit_date)===month);
  const issues=[];
  const push=(v,type,note,severity="مراجعة")=>issues.push({ref:v?.id??v?.teacher_id??"—",month:monthKey(v?.visit_date)||"—",teacher:v?.teacher_id?v5TeacherName(v.teacher_id):"—",type,note,severity});
  raw.forEach(v=>{
    const t=v14TeacherForVisit(v);
    if(!t) push(v,"ربط المعلمة","الزيارة لا ترتبط بمعلمة موجودة في جدول المعلمات.","حرج");
    if(!v.department_id){
      const fallback=v14VisitDept(v);
      push(v,"القسم",fallback!=="غير محدد"?`قسم الزيارة غير مسجل؛ تم الاستدلال من تكليف المعلمة: ${fallback}.`:`قسم الزيارة غير مسجل ولا يوجد قسم بديل معروف.`,fallback!=="غير محدد"?"تنبيه":"حرج");
    }
    if(!v.subject_id){
      const assigned=v14AssignedSubjectsForVisit(v);
      const fallback=v7ActualSubject(v);
      push(v,"المادة",fallback!=="غير محدد"?`مادة الزيارة غير مسجلة خامًا؛ العرض يستخدم تكليف المعلمة: ${fallback}${assigned.length>1?" (لا يمكن تحديد أي مادة منها تخص هذه الزيارة دون تسجيل المادة).":"."}`:"مادة الزيارة غير مسجلة ولا توجد مادة مسندة يمكن الاستدلال بها.",assigned.length===1?"تنبيه":"مراجعة");
    } else if(!v14RawVisitSubject(v)) push(v,"المادة","subject_id موجود لكنه لا يطابق مادة معروفة في جدول المواد.","حرج");
    if(!v.observer_id || !v8Profile(v.observer_id)) push(v,"المقيم",!v.observer_id?"الزيارة بلا مقيم مسجل.":"معرّف المقيم لا يطابق ملفًا معروفًا في profiles.","حرج");
    const cr=v5CriteriaForVisit(v.id);
    const nums=new Set(cr.map(x=>Number(x.criterion_no)).filter(n=>n>=1&&n<=18));
    if(!cr.length) push(v,"م1–م18","الزيارة بلا أي تقييم للمعايير م1–م18.","حرج");
    else if(nums.size<18) push(v,"م1–م18",`الزيارة تحتوي ${nums.size} من 18 معيارًا؛ ينقص ${18-nums.size} معيارًا.`,"مراجعة");
  });
  // Assignment quality for teachers who participate in the selected scope.
  const tids=new Set(raw.map(v=>String(v.teacher_id)));
  teachers.filter(t=>tids.has(String(t.id))).forEach(t=>{
    if(v6TeacherCoverageMode(t)==="teacher_only") return;
    const cfg=(v6ConfiguredSubjects(t)||[]).filter(x=>x&&x!=="غير محدد");
    if(!cfg.length) issues.push({ref:t.id,month:month||"—",teacher:t.full_name,type:"تكليف المواد",note:"لا توجد مواد مسندة معروفة للمعلمة؛ يلزم مراجعة teacher_subjects/التكليف.",severity:"مراجعة"});
  });
  // Surface probable shared observations so the auditor can verify merge assumptions.
  const actual=v7ActualVisits(raw,{source:"official"});
  actual.filter(v=>v._shared).forEach(v=>issues.push({ref:v.id,month:monthKey(v.visit_date)||"—",teacher:v5TeacherName(v.teacher_id),type:"زيارة مشتركة",note:`تم دمجها كزيارة فعلية واحدة. المقيمون: ${(v._members||[]).map(m=>v5ObserverName(m.observer_id)).join(" + ")}. الحكم الرسمي من القيادة العليا عند توفرها.`,severity:"معلومة"}));
  return issues.sort((a,b)=>String(a.month).localeCompare(String(b.month))||String(a.teacher).localeCompare(String(b.teacher),"ar"));
}
function v72Quality(month){return v14QualityRows(month);}
function renderDataQuality(){
  v72InitCommon("qualityMonth");
  const month=$("qualityMonth")?.value||"",out=$("dataQualityOutput"); if(!out)return;
  const issues=v14QualityRows(month);
  const actionable=issues.filter(x=>x.severity!=="معلومة");
  const months=[...new Set(issues.map(x=>x.month).filter(x=>x&&x!=="—"))].sort();
  const monthSummary=!month&&months.length?`<div class="analysis-note"><strong>التوزيع الشهري:</strong> ${months.map(m=>`${esc(v5MonthLabel(m))}: ${issues.filter(x=>x.month===m&&x.severity!=="معلومة").length} ملاحظة`).join(" • ")}</div>`:"";
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>سجل تدقيق جودة البيانات</h3><p>${esc(v5MonthLabel(month))}</p></div><div class="v5-kpis"><b>${actionable.length}<small>ملاحظات تحتاج مراجعة</small></b><b>${issues.filter(x=>x.severity==="حرج").length}<small>حرجة</small></b><b>${issues.filter(x=>x.type==="المادة").length}<small>ملاحظات مادة</small></b><b>${issues.filter(x=>x.type==="زيارة مشتركة").length}<small>زيارات مشتركة مدققة</small></b></div></div>${monthSummary}<div class="table-wrap"><table><thead><tr><th>الشهر</th><th>المرجع</th><th>المعلمة</th><th>النوع</th><th>المستوى</th><th>الملاحظة</th></tr></thead><tbody>${issues.map(x=>`<tr><td>${esc(x.month==="—"?"—":v5MonthLabel(x.month))}</td><td>${esc(String(x.ref))}</td><td>${esc(x.teacher)}</td><td>${esc(x.type)}</td><td>${esc(x.severity)}</td><td>${esc(x.note)}</td></tr>`).join("")||'<tr><td colspan="6">لا توجد ملاحظات آلية في النطاق.</td></tr>'}</tbody></table></div><div class="analysis-note">التدقيق يفرّق بين <strong>البيانات الخام</strong> وبين القيم المستدل عليها للعرض. لذلك قد تُعرض المادة صحيحة في التقارير من تكليف المعلمة، مع بقاء تنبيه هنا بأن مادة الزيارة نفسها لم تُسجل في السجل الخام.</div></article>`;
}

/* =========================================================
   V15 SUPPORT & FOLLOW-UP REGISTER — clear operational view
   Built on top of the stable subject-id/quality version.
========================================================= */
function v15SupportInitFilters(){
  const fill=(id,rows,placeholder,vf,lf)=>{const el=$(id);if(!el)return;const old=el.value;v5FillSelect(id,rows,placeholder,vf,lf);if(old&&[...el.options].some(o=>o.value===old))el.value=old;};
  fill("supportMonthFilter",availableMonths(),"كل الأشهر",x=>x,x=>v5MonthLabel(x));
  fill("supportDeptFilter",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name);
  fill("supportTeacherFilter",activeRows(teachers),"كل المعلمات",x=>x.id,x=>x.full_name);
}
function v15SupportActionsForTeacher(id){return (supports||[]).filter(s=>String(s.teacher_id)===String(id));}
function v15LatestSupportAction(id){return v15SupportActionsForTeacher(id).slice().sort((a,b)=>String(b.support_date||"").localeCompare(String(a.support_date||"")))[0]||null;}
function v15TeacherVisits(rows,id){return v7ActualVisits((rows||[]).filter(v=>String(v.teacher_id)===String(id)),{source:"official"}).sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date)));}
function v15SupportState(t,scopeRows,allRows){
  const current=v5TeacherDiagnosis(scopeRows,t.id), all=v5TeacherDiagnosis(allRows,t.id), acts=v15SupportActionsForTeacher(t.id), latest=v15LatestSupportAction(t.id);
  const dbStatus=String(latest?.status||"").trim();
  if(/مغلق/.test(dbStatus)) return {key:"closed",label:"مغلقة",reason:"تم إغلاق إجراء الدعم المسجل.",diag:current,latest,acts};
  const allVisits=v15TeacherVisits(allRows,t.id);
  const lastTwo=allVisits.slice(-2);
  if(acts.length && lastTwo.length>=2){
    const last=v5TeacherDiagnosis(lastTwo,t.id);
    if(last.key==="stable") return {key:"improved",label:"تحسن",reason:"الرصد اللاحق لا يظهر مؤشرات جزئية متكررة في آخر زيارتين معتمدتين.",diag:current,latest,acts};
  }
  if(current.key==="priority") return {key:"priority",label:"أولى بالرعاية",reason:current.reason,diag:current,latest,acts};
  if(current.key==="targeted") return {key:"targeted",label:"دعم مستهدف",reason:current.reason,diag:current,latest,acts};
  if(current.key==="verify") return {key:"verify",label:"متابعة للتحقق",reason:current.reason,diag:current,latest,acts};
  if(acts.length) return {key:"verify",label:"متابعة قائمة",reason:"يوجد إجراء دعم مسجل ويحتاج رصدًا لاحقًا لقياس الأثر.",diag:current,latest,acts};
  return null;
}
function v15EvaluatorSummary(vs){
  if(!vs.length)return "—";
  const counts={};
  vs.forEach(v=>(v._members?.length?v._members:[v]).forEach(m=>{const n=v5ObserverName(m.observer_id);counts[n]=(counts[n]||0)+1;}));
  return Object.entries(counts).map(([n,c])=>`${esc(n)}: ${c}`).join(" • ");
}
function v15VisitTrail(vs){
  if(!vs.length)return "—";
  return vs.map(v=>{
    const members=(v._members||[v]).map(m=>v5ObserverName(m.observer_id));
    const who=v._shared?`مشتركة: ${members.join(" + ")}`:members[0];
    return `${esc(formatDate(v.visit_date))} — ${esc(v7ActualSubject(v))} — ${esc(who)} — ${esc(ratingLabel(v.overall_rating))}`;
  }).join("<br>");
}
function renderSupport(){
  const out=$("supportContent");if(!out)return;
  v15SupportInitFilters();
  const month=$("supportMonthFilter")?.value||"", dept=$("supportDeptFilter")?.value||"", teacher=$("supportTeacherFilter")?.value||"", status=$("supportStatusFilter")?.value||"";
  const scope=v7ScopeRows(month,dept), allDept=v7ScopeRows("",dept);
  const candidates=activeRows(teachers).filter(t=>(!dept||v61TeacherDeptIds(t).some(id=>String(id)===String(dept)))&&(!teacher||String(t.id)===String(teacher)));
  let items=candidates.map(t=>({t,state:v15SupportState(t,scope,allDept),vs:v15TeacherVisits(scope,t.id)})).filter(x=>x.state);
  if(status)items=items.filter(x=>x.state.key===status);
  const rank={priority:5,targeted:4,verify:3,improved:2,closed:1};items.sort((a,b)=>(rank[b.state.key]||0)-(rank[a.state.key]||0)||a.t.full_name.localeCompare(b.t.full_name,"ar"));
  const cnt=k=>items.filter(x=>x.state.key===k).length;
  const rows=items.map(({t,state,vs})=>{
    const last=vs[vs.length-1], partial=state.diag?.partial||[], action=state.latest;
    const actionText=action?`${esc(action.support_type||"دعم مسجل")}${action.support_date?` — ${esc(formatDate(action.support_date))}`:""}`:"لم يسجل تدخل بعد";
    const next=state.key==="priority"?"تدخل مهني موجه + إعادة قياس":state.key==="targeted"?"تنفيذ دعم محدد ثم زيارة متابعة":state.key==="verify"?"زيارة مستقلة للتحقق":state.key==="improved"?"توثيق الأثر والنظر في الإغلاق":"أرشفة الحالة";
    return `<tr><td><strong>${esc(t.full_name)}</strong></td><td>${esc(v7TeacherDeptLabel(t,dept))}</td><td>${v5Badge({key:state.key,label:state.label})}</td><td>${esc(state.reason)}</td><td>${vs.length}</td><td>${v15EvaluatorSummary(vs)}</td><td>${partial.length?`م${partial.join("، م")}`:"—"}</td><td>${actionText}</td><td>${last?esc(formatDate(last.visit_date)):"—"}</td><td>${esc(next)}</td></tr>`;
  }).join("");
  const detail=teacher&&items.length?`<article class="panel" style="margin-top:18px"><h3>المسار التفصيلي — ${esc(items[0].t.full_name)}</h3><p><strong>الزيارات والمقيمون والحكم</strong></p><div class="analysis-note">${v15VisitTrail(items[0].vs)}</div><p><strong>إجراءات الدعم المسجلة</strong></p><div class="analysis-note">${items[0].state.acts.length?items[0].state.acts.map(a=>`${esc(a.support_type||"دعم")} — ${esc(formatDate(a.support_date))} — ${esc(a.support_details||"بدون تفاصيل")}`).join("<br>"):"لا يوجد تدخل دعم مسجل في قاعدة البيانات حتى الآن."}</div></article>`:"";
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>سجل الدعم والمتابعة</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"جميع الأقسام")}</p></div><div class="v5-kpis"><b>${items.length}<small>حالات معروضة</small></b><b>${cnt("priority")}<small>أولى بالرعاية</small></b><b>${cnt("targeted")}<small>دعم مستهدف</small></b><b>${cnt("verify")}<small>تحقق</small></b><b>${cnt("improved")}<small>تحسن</small></b><b>${cnt("closed")}<small>مغلقة</small></b></div></div><div class="analysis-note"><strong>طريقة القراءة:</strong> هذه الصفحة لا تعتبر كل معلمة «حالة دعم مفتوحة». تظهر فقط الحالات التي لديها مؤشر متابعة فعلي أو إجراء دعم مسجل. «أولى بالرعاية» = تكرار مؤشر جزئي عبر زيارات مستقلة، «دعم مستهدف» = عدة مؤشرات جزئية دون تكرار مستقل، «متابعة للتحقق» = مؤشر يحتاج زيارة مستقلة، و«تحسن» = تحسن مثبت في الرصد اللاحق.</div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>الحالة الحالية</th><th>سبب الحالة</th><th>زيارات فعلية</th><th>المقيمون وعدد زياراتهم</th><th>المعايير محل المتابعة</th><th>الدعم المنفذ</th><th>آخر رصد</th><th>الإجراء القادم</th></tr></thead><tbody>${rows||'<tr><td colspan="10">لا توجد حالات دعم/متابعة فعلية ضمن النطاق المحدد.</td></tr>'}</tbody></table></div></article>${detail}`;
}

/* =========================================================
   ATHAR — PROFESSIONAL GROWTH & RECOGNITION
   Read-only layer over the approved actual-visit engine.
   It does not alter visit diagnoses, support states, or Supabase data.
========================================================= */
let ATHAR_TAB="dashboard";
function setAtharTab(tab){ATHAR_TAB=tab||"dashboard";document.querySelectorAll("[data-athar-tab]").forEach(b=>b.classList.toggle("active",b.dataset.atharTab===ATHAR_TAB));renderAthar();}
function atharFillFilters(){
  const keep=(id,rows,placeholder,vf,lf)=>{const el=$(id);if(!el)return;const old=el.value;v5FillSelect(id,rows,placeholder,vf,lf);if(old&&[...el.options].some(o=>o.value===old))el.value=old;};
  keep("atharMonth",availableMonths(),"كل الأشهر",x=>x,x=>v5MonthLabel(x));
  keep("atharDept",activeRows(departments),"كل الأقسام",x=>x.id,x=>x.name);
  keep("atharTeacher",activeRows(teachers),"كل المعلمات",x=>x.id,x=>x.full_name);
}
function atharCriterionRows(v){return v5CriteriaForVisit(v.id)||[];}
function atharCriterionMap(v){const m={};atharCriterionRows(v).forEach(x=>m[String(x.criterion_no)]=num(x.rating));return m;}
function atharCriterionName(c){const q=(criteria||[]).find(x=>String(x.criterion_no??x.no??x.id)===String(c));return q?.criterion_text||q?.text||q?.name||`المعيار م${c}`;}
function atharCriterionLabel(c){return `م${c} — ${atharCriterionName(c)}`;}
function atharMonthEnd(month){if(!month)return null;const [y,m]=month.split('-').map(Number);return new Date(y,m,0,23,59,59,999);}
function atharRowsThrough(month,dept){const end=atharMonthEnd(month);return visits.filter(v=>(!end||new Date(String(v.visit_date).slice(0,10)+'T12:00:00')<=end)&&(!dept||String(v8DeptIdForTeacher(teachers.find(t=>String(t.id)===String(v.teacher_id))||{}))===String(dept)));}
function atharTeacherActual(t,rows){return v7ActualVisits((rows||[]).filter(v=>String(v.teacher_id)===String(t.id)),{source:"official"}).sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date)));}
function atharEvidence(t,historyRows,periodRows=[]){
  const av=atharTeacherActual(t,historyRows), pav=atharTeacherActual(t,periodRows), series={};
  av.forEach(v=>{const m=atharCriterionMap(v);Object.entries(m).forEach(([c,r])=>{(series[c]||=[]).push({r,date:v.visit_date,visit:v});});});
  const improved=[],repeatedStrong=[],sustainedStrong=[];
  Object.entries(series).forEach(([c,a])=>{
    if(a.length>=2 && a[a.length-1].r>a[0].r) improved.push({c,from:a[0].r,to:a[a.length-1].r,count:a.length});
    const strong=a.filter(x=>x.r>=3); if(strong.length>=2) repeatedStrong.push({c,count:strong.length});
    if(a.length>=3 && a.slice(-3).every(x=>x.r>=3)) sustainedStrong.push({c,count:3});
  });
  const evaluators=new Set();av.forEach(v=>(v._members||[v]).forEach(m=>evaluators.add(String(m.observer_id))));
  const overall = av.map(v=>num(v.overall_rating)).filter(Boolean);
  const lastOverall = overall[overall.length-1] || 0;
  const prevOverall = overall.length>=2 ? overall[overall.length-2] : 0;
  const last2Overall = overall.slice(-2);
  const last3Overall = overall.slice(-3);
  const overallImproved = overall.length>=2 && lastOverall>prevOverall;
  const overallNotDeclined = overall.length>=2 && lastOverall>=prevOverall;

  let level={key:"start",label:"✨ بداية رحلة أثر",reason:av.length===1?"هذه أول زيارة فعلية مسجلة حتى الفترة المختارة؛ نحتاج رصدًا لاحقًا قبل استنتاج النمو.":"توجد بيانات رصد سابقة، لكن الدليل التراكمي لا يكفي بعد لمنح مستوى تكريم مهني."};

  // النمو لا يُمنح لمجرد تحسن معيارين إذا ظل الحكم العام ضعيفًا.
  if(av.length>=2 && lastOverall>=2 && (overallImproved || (overallNotDeclined && improved.length>=2)))
    level={key:"growing",label:"🌱 نامية بأثر",reason:`تحسن مهني مثبت مع حكم عام أخير «${ratingLabel(lastOverall)}»${overallImproved?" وتحسن في الحكم العام":""}${improved.length?`، وتحسن في ${improved.length} معايير مقاسة` : ""}.`};

  // صانعة أثر تتطلب حكمًا عامًا قويًا في زيارتين متتاليتين مع قوة معيارية متكررة.
  if(av.length>=2 && last2Overall.length===2 && last2Overall.every(r=>r>=3) && repeatedStrong.length>=2)
    level={key:"maker",label:"💎 صانعة أثر",reason:`حكم عام قوي في آخر زيارتين مع قوة واضحة ومتكررة في ${repeatedStrong.length} معايير.`};

  // قدوة في الممارسة تتطلب استدامة الحكم القوي عبر ثلاث زيارات فعلية مستقلة.
  if(av.length>=3 && last3Overall.length===3 && last3Overall.every(r=>r>=3) && sustainedStrong.length>=2)
    level={key:"rolemodel",label:"🏆 قدوة في الممارسة",reason:`حكم عام قوي ومستدام خلال آخر ثلاث زيارات مع قوة مستدامة في ${sustainedStrong.length} معايير${evaluators.size>1?"، ومع تنوع المقيمين":""}.`};
  const acts=v15SupportActionsForTeacher(t.id).slice().sort((a,b)=>String(a.support_date||"").localeCompare(String(b.support_date||"")));
  const lastAct=acts[acts.length-1]||null;let supportImpact=null;
  if(lastAct?.support_date){const before=av.filter(v=>String(v.visit_date)<String(lastAct.support_date)),after=av.filter(v=>String(v.visit_date)>=String(lastAct.support_date));if(before.length&&after.length){const b=atharCriterionMap(before[before.length-1]),a=atharCriterionMap(after[after.length-1]),g=[];Object.keys(a).forEach(c=>{if(b[c]!=null&&a[c]>b[c])g.push(c)});if(g.length)supportImpact={criteria:g,action:lastAct,after:after.length};}}
  return {t,av,pav,series,improved,repeatedStrong,sustainedStrong,evaluators,level,acts,supportImpact};
}
function atharScope(){
  const month=$("atharMonth")?.value||"",dept=$("atharDept")?.value||"",teacher=$("atharTeacher")?.value||"";
  const periodRows=v7ScopeRows(month,dept),historyRows=atharRowsThrough(month,dept);
  let ts=activeRows(teachers).filter(t=>(!dept||v61TeacherDeptIds(t).some(id=>String(id)===String(dept)))&&(!teacher||String(t.id)===String(teacher)));
  const items=ts.map(t=>atharEvidence(t,historyRows,periodRows)).filter(x=>x.av.length);
  return {month,dept,teacher,periodRows,historyRows,ts,items};
}
function atharLevelRank(k){return {rolemodel:4,maker:3,growing:2,start:1}[k]||0;}
function atharWhy(x){return `<div class="athar-reason"><strong>لماذا؟</strong> ${esc(x.level.reason)}</div>`;}
function atharOpenTeacher(id){showView("teacher360");const el=$("teacher360Filter");if(el){el.value=String(id);renderTeacher360();}}
function atharEvidenceNames(x){const src=x.level.key==="rolemodel"?x.sustainedStrong:x.level.key==="maker"?x.repeatedStrong:x.improved;return src.slice(0,3).map(z=>atharCriterionLabel(z.c));}
function atharDashboard(scope){
  const {month,dept,items}=scope,count=k=>items.filter(x=>x.level.key===k).length,withGrowth=items.filter(x=>x.improved.length).length,withStrength=items.filter(x=>x.repeatedStrong.length).length,impact=items.filter(x=>x.supportImpact).length;
  const top=items.slice().sort((a,b)=>atharLevelRank(b.level.key)-atharLevelRank(a.level.key)||b.improved.length-a.improved.length).slice(0,8);
  return `<article class="panel v5-report"><div class="v5-report-head"><div><h3>لوحة أثر</h3><p>${esc(v5MonthLabel(month))} • ${esc(dept?v5DeptName(dept):"كل المدرسة")}</p></div><div class="v5-kpis"><b>${items.length}<small>رحلات مهنية مرصودة</small></b><b>${withGrowth}<small>ظهر لديهن نمو تراكمي</small></b><b>${withStrength}<small>قوة متكررة</small></b><b>${impact}<small>تحسن لاحق لدعم مسجل</small></b></div></div><div class="v5-kpis"><b>${count("rolemodel")}<small>قدوة في الممارسة</small></b><b>${count("maker")}<small>صانعة أثر</small></b><b>${count("growing")}<small>نامية بأثر</small></b><b>${count("start")}<small>بداية رحلة أثر</small></b></div><div class="analysis-note"><strong>منهجية أثر:</strong> الشهر يحدد فترة العرض، أما مستوى المعلمة فيُحسب تراكميًا من زياراتها السابقة حتى نهاية الفترة المختارة. الزيارة المشتركة لنفس الموقف الصفي تُحسب زيارة فعلية واحدة ويُعتمد تقييم القيادة العليا.</div><h4>أبرز الرحلات المهنية</h4><div class="athar-card-grid">${top.map(x=>`<div class="athar-recognition"><span class="athar-level">${x.level.label}</span><h3>${esc(x.t.full_name)}</h3><small>${esc(v7TeacherDeptLabel(x.t,dept))} • ${x.pav.length} هذا الشهر • ${x.av.length} تراكميًا</small>${atharWhy(x)}<button class="btn no-print" type="button" onclick="atharOpenTeacher('${esc(String(x.t.id))}')">فتح بطاقة 360°</button></div>`).join("")||"لا توجد بيانات رصد ضمن النطاق."}</div></article>`;
}
function atharMonth(scope){
  let month=scope.month;if(!month){const ms=availableMonths();month=ms[0]||"";}
  const items=scope.items.filter(x=>x.pav.length&&x.level.key!=="start").sort((a,b)=>atharLevelRank(b.level.key)-atharLevelRank(a.level.key));
  return `<article class="panel v5-report"><div class="v5-report-head"><div><h3>أثر الشهر</h3><p>${esc(v5MonthLabel(month))} • الترشيح يعتمد على تاريخ المعلمة التراكمي حتى نهاية الشهر</p></div><div class="v5-kpis"><b>${items.length}<small>ترشيحات بدليل</small></b><b>${items.filter(x=>x.improved.length).length}<small>نمو تراكمي مرصود</small></b><b>${items.filter(x=>x.repeatedStrong.length).length}<small>قوة متكررة</small></b></div></div><div class="analysis-note">عدد «زيارات الشهر» هو عدد المواقف الصفية الفعلية بعد دمج الزيارة المشتركة، وليس عدد المقيمين.</div><div class="table-wrap"><table><thead><tr><th>المعلمة</th><th>القسم</th><th>المستوى المقترح</th><th>الدليل</th><th>زيارات الشهر</th><th>التراكمي حتى الشهر</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.t.full_name)}</td><td>${esc(v7TeacherDeptLabel(x.t,scope.dept))}</td><td><span class="athar-level">${x.level.label}</span></td><td>${esc(x.level.reason)}${atharEvidenceNames(x).length?`<br><small>${atharEvidenceNames(x).map(esc).join(" • ")}</small>`:""}</td><td>${x.pav.length}</td><td>${x.av.length}</td></tr>`).join("")||'<tr><td colspan="6">لا توجد ترشيحات مستوفية للقواعد في هذه الفترة.</td></tr>'}</tbody></table></div></article>`;
}
function atharJourney(scope){
  let item=scope.items.find(x=>String(x.t.id)===String(scope.teacher));if(!item&&scope.items.length===1)item=scope.items[0];
  if(!item){
    const cards=scope.items.map(x=>`<div class="athar-recognition"><span class="athar-level">${x.level.label}</span><h3>${esc(x.t.full_name)}</h3><small>${x.pav.length} زيارة في الفترة • ${x.av.length} زيارة تراكمية</small><button class="btn no-print" type="button" onclick="document.getElementById('atharTeacher').value='${esc(String(x.t.id))}';renderAthar()">عرض رحلة النمو</button></div>`).join("");
    return `<article class="panel"><h3>رحلة النمو المهني</h3><div class="analysis-note">تعرض القائمة الرحلات التراكمية حتى نهاية الفترة المختارة. اختاري معلمة للتفاصيل.</div><div class="athar-card-grid">${cards||"لا توجد رحلات مهنية ضمن النطاق."}</div></article>`;
  }
  const steps=item.av.map(v=>{const m=atharCriterionMap(v),strong=Object.keys(m).filter(c=>m[c]>=3),partial=Object.keys(m).filter(c=>m[c]===1),members=[...(v._members||[v])],names=[...new Set(members.map(z=>v5ObserverName(z.observer_id)).filter(Boolean))];return `<div class="athar-step"><strong>${esc(formatDate(v.visit_date))}</strong> — ${esc(v7ActualSubject(v))}<br><small>${v._shared?`زيارة مشتركة: ${names.map(esc).join(" + ")}`:`المقيم: ${esc(names[0]||"—")}`}</small><div>الحكم السياقي المعتمد: ${esc(ratingLabel(v.overall_rating))}</div><div>قوة بارزة: ${strong.length?strong.slice(0,4).map(c=>esc(atharCriterionLabel(c))).join(" • "):"—"}</div><div>تحتاج متابعة: ${partial.length?partial.slice(0,4).map(c=>esc(atharCriterionLabel(c))).join(" • "):"—"}</div></div>`}).join("");
  const impact=item.supportImpact?`<div class="analysis-note"><strong>تحسن لاحق لتدخل مسجل:</strong> بعد «${esc(item.supportImpact.action.support_type||"دعم مهني")}" ظهر تحسن في ${item.supportImpact.criteria.map(c=>esc(atharCriterionLabel(c))).join("، ")}. هذه علاقة زمنية مرصودة وليست إثباتًا سببيًا.</div>`:"";
  return `<article class="panel v5-report"><div class="v5-report-head"><div><h3>رحلة النمو المهني — ${esc(item.t.full_name)}</h3><p>بطاقة متابعة مهنية خاصة • ${scope.month?`${item.pav.length} زيارة في ${esc(v5MonthLabel(scope.month))} • `:""}${item.av.length} زيارة فعلية تراكمية حتى نهاية الفترة</p></div><span class="athar-level">${item.level.label}</span></div>${atharWhy(item)}<div class="v5-kpis"><b>${item.pav.length}<small>زيارات الفترة</small></b><b>${item.av.length}<small>إجمالي تراكمي</small></b><b>${item.improved.length}<small>معايير تحسنت</small></b><b>${item.evaluators.size}<small>مقيمون شاركوا</small></b></div>${impact}<h4>الخط الزمني التراكمي</h4><div class="athar-timeline">${steps}</div><div class="analysis-note"><strong>الخطوة القادمة:</strong> ${item.level.key==="rolemodel"?"توثيق الممارسة وإتاحة مشاركة الخبرة.":item.level.key==="maker"?"متابعة استدامة القوة في زيارة لاحقة.":item.level.key==="growing"?"تثبيت التحسن وإعادة الرصد.":"استكمال الرصد قبل أي استنتاج مهني."}</div><button class="btn no-print" type="button" onclick="atharOpenTeacher('${esc(String(item.t.id))}')">فتح بطاقة المعلمة 360°</button></article>`;
}
function atharCardText(x){const names=atharEvidenceNames(x);const base=x.level.key==="growing"?"تقديرًا لنمو مهني مثبت":x.level.key==="maker"?"تقديرًا لقوة مهنية متكررة":"تقديرًا لاستدامة التميز المهني";return `${base} وفق مؤشرات استمارة الزيارة الصفية${names.length?`، ومن أبرزها: ${names.join("، ")}`:""}، استنادًا إلى ${x.av.length} زيارة فعلية مستقلة.`;}
function atharCards(scope){
  const items=scope.items.filter(x=>["growing","maker","rolemodel"].includes(x.level.key)).sort((a,b)=>atharLevelRank(b.level.key)-atharLevelRank(a.level.key));
  return `<article class="panel v5-report"><div class="v5-report-head"><div><h3>بطاقات أثر للتكريم</h3><p>نسخة عامة آمنة: تعرض الممارسة الإيجابية ومصدر الدليل والفترة، ولا تعرض جوانب الضعف أو أسماء المقيمين.</p></div><div class="v5-kpis"><b>${items.length}<small>بطاقات مستحقة</small></b></div></div><div class="athar-card-grid">${items.map(x=>`<div class="athar-recognition athar-public-card"><div>✨ أثر | النمو والتميز المهني</div><h3>${esc(x.t.full_name)}</h3><span class="athar-level">${x.level.label}</span><p>${esc(atharCardText(x))}</p><small>${scope.month?esc(v5MonthLabel(scope.month))+" • ":""}مدرسة الرفاع الغربي الابتدائية للبنين</small><button class="btn no-print" type="button" onclick="atharPrintCard('${esc(String(x.t.id))}')">طباعة البطاقة</button></div>`).join("")||"لا توجد بطاقات استوفت قواعد التكريم في النطاق الحالي."}</div></article>`;
}
function atharPrintCard(id){
  const scope=atharScope(),x=scope.items.find(a=>String(a.t.id)===String(id));if(!x)return;const text=atharCardText(x);
  const w=window.open("","_blank","width=900,height=700");if(!w)return;const headerUrl=new URL("school-header.jpg",location.href).href;w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقة أثر</title><style>body{font-family:Arial,Tahoma,sans-serif;padding:50px;text-align:center}img{max-width:100%;max-height:120px}.card{border:2px solid #bbb;border-radius:22px;padding:50px 35px;margin-top:25px}h1{font-size:34px}h2{font-size:28px}.level{font-size:24px;font-weight:700;margin:22px}p{font-size:19px;line-height:1.9}.period{font-size:16px;margin-top:16px}.foot{display:flex;justify-content:space-between;margin-top:55px;font-size:15px}@media print{button{display:none}}</style></head><body><img src="${headerUrl}"><div class="card"><h1>✨ بطاقة أثر</h1><h2>${esc(x.t.full_name)}</h2><div class="level">${x.level.label}</div><p>${esc(text)}</p><div class="period">${scope.month?esc(v5MonthLabel(scope.month))+" • ":""}${x.av.length} زيارة فعلية تراكمية</div><div class="foot"><span>إعداد: فاتن صلاح<br>اختصاصية مصادر التعلم</span><span>المديرة المساعدة: خلود الكعبي</span><span>مديرة المدرسة: أحلام السويدي</span></div></div><button onclick="window.print()">طباعة / حفظ PDF</button></body></html>`);w.document.close();
}
function renderAthar(){atharFillFilters();document.querySelectorAll("[data-athar-tab]").forEach(b=>b.classList.toggle("active",b.dataset.atharTab===ATHAR_TAB));const out=$("atharOutput");if(!out)return;const scope=atharScope();out.innerHTML=ATHAR_TAB==="month"?atharMonth(scope):ATHAR_TAB==="journey"?atharJourney(scope):ATHAR_TAB==="cards"?atharCards(scope):atharDashboard(scope);}



/* =========================================================
   V10 — CUMULATIVE PERFORMANCE PROGRESS + STRICT SAME-DAY DEDUP
   2026-10-11
   Business rule: one teacher can have only ONE actual visit per calendar date.
   Duplicate rows on the same date are data-entry/shared-leadership records, not
   additional visits. Official analysis prefers upper leadership when present.
========================================================= */
function v10Date(v){
  const raw=String(v?.visit_date||"").trim();
  if(!raw)return "";
  // Normalize every stored representation to one calendar key YYYY-MM-DD.
  // This prevents the same day being counted twice when one row uses / and another -,
  // or when a timestamp/timezone suffix is present.
  const latin=raw.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const m=latin.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if(m)return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  const d=new Date(latin);
  if(!Number.isNaN(d.getTime()))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return latin.slice(0,10).replace(/[\/.]/g,"-");
}
function v10NormName(s){return String(s||"").trim().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/\s+/g," ").toLowerCase();}
function v10TeacherIdentity(v){
  const t=teachers.find(x=>String(x.id)===String(v?.teacher_id));
  // Prefer the canonical teacher name so accidental duplicate teacher IDs do not create
  // two actual visits for the same person on the same day. Fall back to ID if unavailable.
  return v10NormName(t?.full_name)||`id:${String(v?.teacher_id||"")}`;
}
function v10TeacherDateKey(v){ return `${v10TeacherIdentity(v)}||${v10Date(v)}`; }
function v10Completeness(v){
  const criteriaCount=v5CriteriaForVisit(v.id).length;
  return criteriaCount*10 + (v.overall_rating?5:0) + (v.subject_id?2:0) + (v.department_id?1:0);
}
function v10ChooseBest(rows){
  return (rows||[]).slice().sort((a,b)=>v10Completeness(b)-v10Completeness(a))[0]||null;
}
function v10GroupTeacherDate(rows){
  const m=new Map();
  (rows||[]).forEach(v=>{const k=v10TeacherDateKey(v);if(!m.has(k))m.set(k,[]);m.get(k).push(v);});
  return [...m.values()];
}
function v8ActualVisits(rows,{source="official"}={}){
  const allowed=(rows||[]).filter(v=>["قيادة عليا","قيادة وسطى"].includes(v8Level(v)));
  return v10GroupTeacherDate(allowed).flatMap(g=>{
    let candidates=g;
    if(source==="upper") candidates=g.filter(v=>v8Level(v)==="قيادة عليا");
    else if(source==="middle") candidates=g.filter(v=>v8Level(v)==="قيادة وسطى");
    if(!candidates.length)return [];
    let chosen;
    if(source==="official" || source==="both"){
      const upper=g.filter(v=>v8Level(v)==="قيادة عليا");
      chosen=v10ChooseBest(upper.length?upper:g);
    } else chosen=v10ChooseBest(candidates);
    return [{...chosen,_shared:g.length>1,_members:g,_actualKey:v10TeacherDateKey(chosen),_sameDayDuplicate:g.length>1}];
  }).sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date)));
}
function v7ActualVisits(rows,{source="official",observerId=""}={}){
  if(observerId){
    const p=v8Profile(observerId);if(!p)return [];
    const own=(rows||[]).filter(v=>v8Profile(v.observer_id)===p || [p.id,p.user_id].filter(Boolean).map(String).includes(String(v.observer_id)));
    const ownGroups=v10GroupTeacherDate(own);
    const official=v8ActualVisits(rows,{source:"official"});
    return ownGroups.map(g=>{
      const chosen=v10ChooseBest(g), shared=official.find(x=>x._members?.some(m=>g.includes(m)));
      return {...chosen,_shared:!!shared?shared._shared:g.length>1,_members:shared?shared._members:g,_actualKey:v10TeacherDateKey(chosen)};
    }).sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date)));
  }
  return v8ActualVisits(rows,{source});
}
function v5VisitKey(v){return v10TeacherDateKey(v);}
function v5VisitGroups(rows){return v10GroupTeacherDate(rows);}
function v5ApprovedVisits(rows){return v8ActualVisits(rows,{source:"official"});}
function v4SharedKey(v){return v10TeacherDateKey(v);}
function v4AcceptedVisits(rows,source=v4AnalysisSource()){return v8ActualVisits(rows,{source:source==="all"?"both":source});}

function v10CriterionMap(v){
  const m={};v5CriteriaForVisit(v.id).forEach(r=>m[String(r.criterion_no)]=num(r.rating));return m;
}
function v10TeacherJourney(t,rows=visits){
  const av=v8ActualVisits((rows||[]).filter(v=>String(v.teacher_id)===String(t.id)),{source:"official"});
  return av.sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date))).map((v,i)=>({...v,_visitNo:i+1,_criteria:v10CriterionMap(v)}));
}
function v10Move(a,b){
  if(a==null||b==null)return "waiting";
  a=num(a);b=num(b);return b>a?"improved":b<a?"declined":"stable";
}
function v10MoveLabel(k){return {improved:"تحسن",declined:"تراجع",stable:"ثبات",waiting:"بانتظار إعادة القياس"}[k]||"—";}
function v10MoveBadge(k){const cls={improved:"success",declined:"danger",stable:"warning",waiting:"muted"}[k]||"muted";return `<span class="v5-badge ${cls}">${v10MoveLabel(k)}</span>`;}
function v10OverallTransitions(journey){
  const out=[];for(let i=1;i<journey.length;i++){const a=journey[i-1],b=journey[i];out.push({from:i,to:i+1,a,b,state:v10Move(a.overall_rating,b.overall_rating)});}return out;
}
function v10CriterionStatus(journey,c){
  const seen=journey.filter(v=>v._criteria?.[String(c)]!=null);
  if(!seen.length)return null;
  const first=seen[0],last=seen[seen.length-1];
  if(seen.length===1)return {c,first,last,state:"waiting",count:1};
  return {c,first,last,state:v10Move(first._criteria[String(c)],last._criteria[String(c)]),count:seen.length};
}
function v10JourneyCriteria(journey){
  const keys=[...new Set(journey.flatMap(v=>Object.keys(v._criteria||{})))].sort((a,b)=>num(a)-num(b));
  return keys.map(c=>v10CriterionStatus(journey,c)).filter(Boolean);
}
function v10TeacherProgressBlock(t,journey){
  if(!journey.length)return '<div class="analysis-note">لا توجد زيارات فعلية لهذه المعلمة.</div>';
  const transitions=v10OverallTransitions(journey),criteria=v10JourneyCriteria(journey);
  const trail=journey.map(v=>`<tr><td>الزيارة ${v._visitNo}</td><td>${esc(formatDate(v.visit_date))}</td><td>${esc(ratingLabel(v.overall_rating))}</td><td>${Object.entries(v._criteria||{}).filter(([,r])=>num(r)===1).map(([c])=>`م${esc(c)}`).join("، ")||"—"}</td><td>${v._shared?`مدمجة من ${v._members.length} إدخالات`:"إدخال واحد"}</td></tr>`).join("");
  const trans=transitions.map(x=>`<tr><td>${x.from} ← ${x.to}</td><td>${esc(ratingLabel(x.a.overall_rating))}</td><td>${esc(ratingLabel(x.b.overall_rating))}</td><td>${v10MoveBadge(x.state)}</td></tr>`).join("");
  const needs=criteria.filter(x=>num(x.first._criteria[String(x.c)])===1 || num(x.last._criteria[String(x.c)])===1);
  const crit=needs.map(x=>`<tr><td>م${esc(x.c)}</td><td>${esc(ratingLabel(x.first._criteria[String(x.c)]))}<br><small>زيارة ${x.first._visitNo}</small></td><td>${x.count>1?`${esc(ratingLabel(x.last._criteria[String(x.c)]))}<br><small>زيارة ${x.last._visitNo}</small>`:"لم يُعد قياسه"}</td><td>${v10MoveBadge(x.state)}</td></tr>`).join("");
  return `<h4>مسار تطور الأداء التراكمي</h4><div class="analysis-note"><strong>قاعدة العد:</strong> للمعلمة زيارة فعلية واحدة فقط في التاريخ نفسه. إذا تكرر الإدخال في اليوم نفسه يُدمج، ويُعتمد تقييم القيادة العليا عند وجوده.</div><div class="table-wrap"><table><thead><tr><th>الترتيب</th><th>التاريخ</th><th>الحكم العام</th><th>المعايير الجزئية</th><th>حالة السجل</th></tr></thead><tbody>${trail}</tbody></table></div><h4>تطور الحكم العام بين الزيارات</h4><div class="table-wrap"><table><thead><tr><th>الانتقال</th><th>من</th><th>إلى</th><th>النتيجة</th></tr></thead><tbody>${trans||'<tr><td colspan="4">تحتاج المعلمة زيارة ثانية لقياس التطور.</td></tr>'}</tbody></table></div><h4>إعادة قياس الاحتياجات والمعايير</h4><div class="table-wrap"><table><thead><tr><th>المعيار</th><th>أول رصد</th><th>آخر إعادة قياس</th><th>الحالة</th></tr></thead><tbody>${crit||'<tr><td colspan="4">لا توجد معايير جزئية تحتاج تتبعًا في الرصد المتاح.</td></tr>'}</tbody></table></div>`;
}

// Teacher 360 is cumulative by design; month is only a display cut-off, never a reset.
renderTeacher360 = function(){
  v8InitFilters();const out=$("teacher360Output"),tid=$("teacher360Filter")?.value||"",month=v8MonthValue("teacher360Month");if(!out)return;if(!tid){out.innerHTML='<article class="panel">اختاري المعلمة لعرض البطاقة.</article>';return;}
  const t=teachers.find(x=>String(x.id)===String(tid));
  const end=month?atharMonthEnd(month):null;
  const raw=visits.filter(v=>String(v.teacher_id)===String(tid)&&(!end||new Date(v10Date(v)+'T12:00:00')<=end));
  const journey=v10TeacherJourney(t,raw),cov=v6TeacherSubjectCoverage(t,raw),diag=v5TeacherDiagnosis(raw,tid);
  out.innerHTML=`<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(t?.full_name||"")}</h3><p>${esc(v61TeacherDeptName(t))} • مسار تراكمي ${month?`حتى ${esc(v5MonthLabel(month))}`:"لكل الفترات"}</p></div><div class="v5-kpis"><b>${journey.length}<small>زيارات فعلية</small></b><b>${esc(v72Reliability(journey.length))}<small>موثوقية القراءة</small></b><b>${v5Badge(diag)}<small>الحالة</small></b><b>${v6CoverageBadge(cov)}<small>تغطية المواد</small></b></div></div>${v10TeacherProgressBlock(t,journey)}</article>`;
};

function v10ScopeTeachers(dept=""){
  return activeRows(teachers).filter(t=>!dept||String(v8DeptIdForTeacher(t))===String(dept));
}
function v10ProgressDataset(dept="",month=""){
  const end=month?atharMonthEnd(month):null;
  return v10ScopeTeachers(dept).map(t=>{
    const raw=visits.filter(v=>String(v.teacher_id)===String(t.id)&&(!end||new Date(v10Date(v)+'T12:00:00')<=end));
    return {t,journey:v10TeacherJourney(t,raw)};
  }).filter(x=>x.journey.length);
}
function v10RoundSummary(items){
  const max=Math.max(0,...items.map(x=>x.journey.length));const rounds=[];
  for(let n=1;n<=max;n++){
    const rows=items.map(x=>x.journey[n-1]).filter(Boolean), counts={1:0,2:0,3:0,4:0};rows.forEach(v=>{const r=num(v.overall_rating);if(counts[r]!=null)counts[r]++;});
    rounds.push({n,total:rows.length,counts});
  }return rounds;
}
function v10TransitionSummary(items,n){
  const eligible=items.filter(x=>x.journey.length>=n);
  const basePartial=eligible.filter(x=>num(x.journey[n-1].overall_rating)===1);
  const followed=basePartial.filter(x=>x.journey.length>=n+1);
  const buckets={improved:[],stable:[],declined:[],waiting:[]};
  followed.forEach(x=>buckets[v10Move(x.journey[n-1].overall_rating,x.journey[n].overall_rating)].push(x));
  buckets.waiting=basePartial.filter(x=>x.journey.length<n+1);
  return {basePartial,followed,buckets};
}
function v10TeacherLink(x){return `<button type="button" class="v10-name-link no-print" onclick="atharOpenTeacher('${esc(String(x.t.id))}')">${esc(x.t.full_name)}</button><span class="print-only">${esc(x.t.full_name)}</span>`;}
function v10NamesCell(xs){return xs?.length?`<div class="v10-name-list">${xs.map(v10TeacherLink).join('')}</div>`:'<span class="muted">—</span>';}
function v10RoundBuckets(items,n){
  const b={1:[],2:[],3:[],4:[],other:[]};
  items.forEach(x=>{const v=x.journey[n-1];if(!v)return;const r=num(v.overall_rating);(b[r]||b.other).push(x);});
  return b;
}
function v10SchoolProgressHtml(items,title){
  const rounds=v10RoundSummary(items);
  const rhtml=rounds.map(r=>`<tr><td>الزيارة ${r.n}</td><td>${r.total}</td><td>${r.counts[1]} (${pct(r.counts[1],r.total)}%)</td><td>${r.counts[2]} (${pct(r.counts[2],r.total)}%)</td><td>${r.counts[3]} (${pct(r.counts[3],r.total)}%)</td><td>${r.counts[4]} (${pct(r.counts[4],r.total)}%)</td></tr>`).join("");
  const details=rounds.map(r=>{const b=v10RoundBuckets(items,r.n);return `<details class="v10-round-details"><summary>أسماء المعلمات حسب الحكم — الزيارة ${r.n} (${r.total})</summary><div class="table-wrap"><table><thead><tr><th>الحكم</th><th>العدد</th><th>المعلمات</th></tr></thead><tbody><tr><td>يفي جزئيًا</td><td>${b[1].length}</td><td>${v10NamesCell(b[1])}</td></tr><tr><td>يفي تمامًا</td><td>${b[2].length}</td><td>${v10NamesCell(b[2])}</td></tr><tr><td>يتجاوز</td><td>${b[3].length}</td><td>${v10NamesCell(b[3])}</td></tr><tr><td>يتجاوز بكثير</td><td>${b[4].length}</td><td>${v10NamesCell(b[4])}</td></tr></tbody></table></div></details>`}).join('');
  const thtml=rounds.slice(0,-1).map(r=>{const x=v10TransitionSummary(items,r.n);return `<tr><td>${r.n} ← ${r.n+1}</td><td>${x.basePartial.length}</td><td>${x.followed.length}</td><td>${x.buckets.improved.length}</td><td>${x.buckets.stable.length}</td><td>${x.buckets.waiting.length}</td></tr><tr class="v10-transition-names"><td colspan="6"><details><summary>عرض أسماء انتقال ${r.n} ← ${r.n+1}</summary><div class="v10-transition-grid"><div><strong>تحسن (${x.buckets.improved.length})</strong>${v10NamesCell(x.buckets.improved)}</div><div><strong>استمر جزئيًا (${x.buckets.stable.length})</strong>${v10NamesCell(x.buckets.stable)}</div><div><strong>بانتظار إعادة الزيارة (${x.buckets.waiting.length})</strong>${v10NamesCell(x.buckets.waiting)}</div>${x.buckets.declined.length?`<div><strong>تراجع (${x.buckets.declined.length})</strong>${v10NamesCell(x.buckets.declined)}</div>`:''}</div></details></td></tr>`}).join("");
  return `<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(title)}</h3><p>التحليل حسب ترتيب زيارة كل معلمة، وليس حسب بداية شهر جديد.</p></div><div class="v5-kpis"><b>${items.length}<small>معلمات لهن رصد</small></b><b>${rounds[0]?.total||0}<small>وصلن للزيارة 1</small></b><b>${rounds[1]?.total||0}<small>وصلن للزيارة 2</small></b><b>${rounds[2]?.total||0}<small>وصلن للزيارة 3</small></b></div></div><h4>تطور الحكم العام حسب ترتيب الزيارة</h4><div class="table-wrap"><table><thead><tr><th>ترتيب الزيارة</th><th>عدد المعلمات</th><th>يفي جزئيًا</th><th>يفي تمامًا</th><th>يتجاوز</th><th>يتجاوز بكثير</th></tr></thead><tbody>${rhtml||'<tr><td colspan="6">لا توجد بيانات.</td></tr>'}</tbody></table></div><h4>من هن المعلمات في كل حكم؟</h4>${details||'<div class="analysis-note">لا توجد بيانات أسماء.</div>'}<h4>ماذا حدث لمن حصلن على «يفي جزئيًا»؟</h4><div class="table-wrap"><table><thead><tr><th>الانتقال</th><th>جزئي في الزيارة السابقة</th><th>أُعيدت زيارتهن</th><th>تحسن</th><th>استمر جزئيًا</th><th>بانتظار إعادة الزيارة</th></tr></thead><tbody>${thtml||'<tr><td colspan="6">نحتاج زيارتين على الأقل لقياس الانتقال.</td></tr>'}</tbody></table></div></article>`;
}
function v10CriterionTransitions(items){
  const max=Math.max(0,...items.map(x=>x.journey.length)), rows=[];
  for(let n=1;n<max;n++){
    for(let c=1;c<=18;c++){
      const partial=items.filter(x=>num(x.journey[n-1]?._criteria?.[String(c)])===1);
      if(!partial.length)continue;
      const measured=partial.filter(x=>x.journey[n]?._criteria?.[String(c)]!=null);
      const improved=measured.filter(x=>num(x.journey[n]._criteria[String(c)])>1);
      const still=measured.filter(x=>num(x.journey[n]._criteria[String(c)])===1);
      const declined=measured.filter(x=>num(x.journey[n]._criteria[String(c)])<1);
      const waiting=partial.filter(x=>x.journey[n]?._criteria?.[String(c)]==null);
      rows.push({n,c,partial,measured,improved,still,declined,waiting});
    }
  }
  return rows;
}
function v10CriteriaTransitionsHtml(items){
  const rows=v10CriterionTransitions(items);
  if(!rows.length)return '<div class="analysis-note">لا توجد معايير جزئية يمكن تتبع انتقالها بين زيارتين متتاليتين حتى الآن.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>الانتقال</th><th>المعيار</th><th>جزئي في الزيارة السابقة</th><th>أعيد قياسه في التالية</th><th>تحسن</th><th>ما زال جزئيًا</th><th>لم يُقَس في التالية</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.n} ← ${x.n+1}</td><td>م${x.c}</td><td>${x.partial.length}</td><td>${x.measured.length}</td><td>${x.improved.length}</td><td>${x.still.length}</td><td>${x.waiting.length}</td></tr><tr class="v10-transition-names"><td colspan="7"><details><summary>أسماء م${x.c} في انتقال ${x.n} ← ${x.n+1}</summary><div class="v10-transition-grid"><div><strong>تحسن (${x.improved.length})</strong>${v10NamesCell(x.improved)}</div><div><strong>ما زال جزئيًا (${x.still.length})</strong>${v10NamesCell(x.still)}</div><div><strong>لم يُعد قياسه (${x.waiting.length})</strong>${v10NamesCell(x.waiting)}</div></div></details></td></tr>`).join('')}</tbody></table></div>`;
}
function renderPerformanceProgress(){
  v8Fill("progressDept",activeRows(departments),"كل المدرسة",x=>x.id,x=>x.name);v8Fill("progressMonth",availableMonths(),"حتى آخر تاريخ متاح",x=>x,x=>v5MonthLabel(x));
  const dept=$("progressDept")?.value||"",month=$("progressMonth")?.value||"",out=$("performanceProgressOutput");if(!out)return;const items=v10ProgressDataset(dept,month);
  out.innerHTML=v10SchoolProgressHtml(items,dept?`تطور الأداء التراكمي — ${v5DeptName(dept)}`:"تطور الأداء التراكمي — مستوى المدرسة")+`<article class="panel v5-report"><h3>تطور الاحتياجات م1–م18 بين الزيارات</h3><div class="analysis-note"><strong>القاعدة:</strong> المقارنة هنا بين زيارتين متتاليتين للمعلمة نفسها. إذا لم يظهر المعيار في الزيارة التالية فلا يُحسب تحسنًا، بل «لم يُعد قياسه».</div>${v10CriteriaTransitionsHtml(items)}</article>`;
}

// Department 360 keeps its existing coverage reading and adds the cumulative journey.
const v10OldRenderDepartment360=renderDepartment360;
renderDepartment360=function(){v10OldRenderDepartment360();const dept=$("dept360Filter")?.value||"",month=$("dept360MonthFilter")?.value||"",out=$("department360Output");if(!out||!dept)return;const items=v10ProgressDataset(dept,month);out.insertAdjacentHTML("beforeend",v10SchoolProgressHtml(items,`مسار تطور القسم — ${v5DeptName(dept)}`));};

// Data quality: same teacher/date duplicates are explicitly surfaced for audit, while counted once analytically.
const v10OldQuality=v72Quality;
v72Quality=function(month){const issues=v10OldQuality(month),raw=visits.filter(v=>!month||monthKey(v.visit_date)===month);v10GroupTeacherDate(raw).filter(g=>g.length>1).forEach(g=>issues.push([v10TeacherDateKey(g[0]),`تكرار إدخال لنفس المعلمة في التاريخ نفسه (${g.length} سجلات) — يُحتسب تحليليًا كزيارة واحدة`]));return issues;};

/* ===== V10.2 compact leadership progress dashboard ===== */
function v102CriterionRowsForTransition(items,n){
  const all=v10CriterionTransitions(items);
  return all.filter(x=>x.n===n);
}
function v102CriterionName(x){return atharCriterionLabel(x.c);}
function v102SummaryCards(items,n){
  const rows=v102CriterionRowsForTransition(items,n);
  if(!rows.length)return '<div class="analysis-note">لا توجد احتياجات جزئية قابلة للمقارنة في هذا الانتقال حتى الآن.</div>';
  const persistent=rows.filter(x=>x.still.length).sort((a,b)=>b.still.length-a.still.length).slice(0,5);
  const improved=rows.filter(x=>x.improved.length).sort((a,b)=>b.improved.length-a.improved.length).slice(0,5);
  const waiting=rows.filter(x=>x.waiting.length).sort((a,b)=>b.waiting.length-a.waiting.length).slice(0,5);
  const list=(xs,key,empty)=>xs.length?`<ol class="v102-rank">${xs.map(x=>`<li><strong>${v102CriterionName(x)}</strong><span>${x[key].length}</span></li>`).join('')}</ol>`:`<div class="muted">${empty}</div>`;
  return `<div class="v102-summary-grid"><section><h4>أبرز الاحتياجات المستمرة</h4>${list(persistent,'still','لا توجد احتياجات مستمرة مقاسة في هذا الانتقال.')}</section><section><h4>أبرز المعايير التي ظهر فيها تحسن</h4>${list(improved,'improved','لم يظهر تحسن مثبت حتى الآن.')}</section><section><h4>تحتاج إعادة قياس</h4>${list(waiting,'waiting','لا توجد حالات معلقة لإعادة القياس.')}</section></div>`;
}
function v102CriteriaTable(items,n){
  const rows=v102CriterionRowsForTransition(items,n);
  if(!rows.length)return '<div class="analysis-note">لا توجد معايير جزئية يمكن تتبعها في هذا الانتقال.</div>';
  return `<div class="table-wrap"><table class="v102-criteria-table"><thead><tr><th>المعيار</th><th>ظهر كاحتياج</th><th>أعيد قياسه</th><th>تحسن</th><th>ما زال احتياجًا</th><th>ينتظر إعادة القياس</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(v102CriterionName(x))}</strong></td><td>${x.partial.length}</td><td>${x.measured.length}</td><td>${x.improved.length?`<button class="v102-count" onclick="v102ToggleDetail('v102-${n}-${x.c}-improved')">${x.improved.length}</button>`:'0'}</td><td>${x.still.length?`<button class="v102-count" onclick="v102ToggleDetail('v102-${n}-${x.c}-still')">${x.still.length}</button>`:'0'}</td><td>${x.waiting.length?`<button class="v102-count" onclick="v102ToggleDetail('v102-${n}-${x.c}-waiting')">${x.waiting.length}</button>`:'0'}</td></tr><tr id="v102-${n}-${x.c}-improved" class="v102-detail-row" hidden><td colspan="6"><strong>م${x.c} — تحسن:</strong>${v10NamesCell(x.improved)}</td></tr><tr id="v102-${n}-${x.c}-still" class="v102-detail-row" hidden><td colspan="6"><strong>م${x.c} — ما زال احتياجًا:</strong>${v10NamesCell(x.still)}</td></tr><tr id="v102-${n}-${x.c}-waiting" class="v102-detail-row" hidden><td colspan="6"><strong>م${x.c} — بانتظار إعادة القياس:</strong>${v10NamesCell(x.waiting)}</td></tr>`).join('')}</tbody></table></div>`;
}
function v102ToggleDetail(id){const el=document.getElementById(id);if(el)el.hidden=!el.hidden;}
function v102CriteriaSection(items){
  const max=Math.max(0,...items.map(x=>x.journey.length));
  if(max<2)return '<article class="panel v5-report"><h3>تطور الاحتياجات م1–م18</h3><div class="analysis-note">نحتاج زيارة ثانية على الأقل لبعض المعلمات لقياس تطور الاحتياجات.</div></article>';
  const ns=[];for(let n=1;n<max;n++)ns.push(n);
  const first=ns[0];
  return `<article class="panel v5-report"><div class="v5-report-head"><div><h3>تطور الاحتياجات م1–م18</h3><p>اختاري الانتقال لعرض الخلاصة والتفاصيل. الأسماء لا تظهر إلا عند الضغط على الرقم.</p></div></div><div class="v102-tabs no-print">${ns.map(n=>`<button type="button" class="v102-tab ${n===first?'active':''}" data-v102n="${n}" onclick="v102SelectTransition(${n})">الزيارة ${n} ← ${n+1}</button>`).join('')}</div>${ns.map(n=>`<section class="v102-transition-panel" data-v102panel="${n}" ${n===first?'':'hidden'}>${v102SummaryCards(items,n)}${v102CriteriaTable(items,n)}</section>`).join('')}<div class="analysis-note"><strong>قاعدة القياس:</strong> غياب المعيار في الزيارة التالية لا يعني تحسنًا؛ يظهر «بانتظار إعادة القياس» حتى يُقاس مرة أخرى.</div></article>`;
}
function v102SelectTransition(n){
  document.querySelectorAll('.v102-transition-panel').forEach(x=>x.hidden=String(x.dataset.v102panel)!==String(n));
  document.querySelectorAll('.v102-tab').forEach(x=>x.classList.toggle('active',String(x.dataset.v102n)===String(n)));
}
function v102LeadershipReading(items){
  const rounds=v10RoundSummary(items), max=Math.max(0,...items.map(x=>x.journey.length));
  if(!rounds.length)return '<div class="analysis-note">لا توجد بيانات كافية لإصدار قراءة قيادية.</div>';
  const r1=rounds[0], r2=rounds[1];
  let text=`تم رصد ${items.length} معلمة. `;
  if(r2){const x=v10TransitionSummary(items,1);text+=`من ${x.basePartial.length} معلمات حصلن على «يفي جزئيًا» في الزيارة الأولى، أُعيدت زيارة ${x.followed.length}؛ تحسن ${x.buckets.improved.length} واستمر ${x.buckets.stable.length}، بينما تنتظر ${x.buckets.waiting.length} إعادة الزيارة. `;}
  const crows=v102CriterionRowsForTransition(items,1), topStill=crows.filter(x=>x.still.length).sort((a,b)=>b.still.length-a.still.length)[0], topWait=crows.filter(x=>x.waiting.length).sort((a,b)=>b.waiting.length-a.waiting.length)[0];
  if(topStill){const n=topStill.still.length, tied=crows.filter(x=>x.still.length===n).map(x=>`م${x.c}`).join("، ");text+=`أبرز الاحتياجات المستمرة في انتقال 1 ← 2: ${tied} بواقع ${n} لكل معيار. `;}
  if(topWait){const n=topWait.waiting.length, tied=crows.filter(x=>x.waiting.length===n).map(x=>`م${x.c}`).join("، ");text+=`وتحتاج ${tied} إلى إعادة قياس بواقع ${n} لكل معيار.`;}
  const limited=rounds.filter(r=>r.n>=3&&r.total<5).map(r=>`الزيارة ${r.n} (${r.total})`);
  return `<article class="panel v5-report v102-reading"><h3>قراءة قيادية</h3><p>${text}</p>${limited.length?`<div class="analysis-note warning"><strong>تنبيه:</strong> العينة محدودة في ${limited.join('، ')}؛ لذلك لا يُعمم اتجاهها على مستوى المدرسة/القسم.</div>`:''}</article>`;
}
function v103VisibleNamesByVisit(items){
  const rounds=v10RoundSummary(items);
  if(!rounds.length)return '<article class="panel v5-report"><h3>أسماء المعلمات حسب الحكم وترتيب الزيارة</h3><div class="analysis-note">لا توجد بيانات أسماء.</div></article>';
  const labels=['','يفي جزئيًا','يفي تمامًا','يتجاوز','يتجاوز بكثير'];
  return `<article class="panel v5-report v103-names"><div class="v5-report-head"><div><h3>أسماء المعلمات حسب الحكم وترتيب الزيارة</h3><p>جدول مستقل لكل زيارة؛ الأسماء ظاهرة دائمًا في الشاشة والطباعة، والضغط على اسم المعلمة يفتح بطاقة 360°.</p></div></div>${rounds.map(r=>{const b=v10RoundBuckets(items,r.n);return `<section class="v103-visit-block"><h4>الزيارة ${r.n} — ${r.total} معلمة</h4><div class="table-wrap"><table class="v103-names-table"><thead><tr><th>الحكم</th><th>العدد</th><th>أسماء المعلمات</th></tr></thead><tbody>${[1,2,3,4].map(k=>`<tr><td><strong>${labels[k]}</strong></td><td>${b[k].length}</td><td>${v10NamesCell(b[k])}</td></tr>`).join('')}</tbody></table></div></section>`}).join('')}</article>`;
}
function v104DepartmentProgressSection(items,selectedDept=""){
  const groups=new Map();
  items.forEach(x=>{
    const did=String(v8DeptIdForTeacher(x.t)||"");
    if(selectedDept && did!==String(selectedDept))return;
    if(!groups.has(did))groups.set(did,[]);
    groups.get(did).push(x);
  });
  const rows=[...groups.entries()].map(([did,xs])=>{
    const r=v10RoundSummary(xs), t=v10TransitionSummary(xs,1);
    const r1=r[0]||{total:0,counts:{1:0,2:0,3:0,4:0}}, r2=r[1]||{total:0,counts:{1:0,2:0,3:0,4:0}};
    return {did,name:did?v5DeptName(did):"غير محدد",xs,r1,r2,t};
  }).sort((a,b)=>a.name.localeCompare(b.name,"ar"));
  if(!rows.length)return `<article class="panel v5-report"><h3>التطور الأكاديمي حسب القسم</h3><div class="analysis-note">لا توجد بيانات أقسام ضمن النطاق الحالي.</div></article>`;
  const body=rows.map(g=>`<tr><td><strong>${esc(g.name)}</strong></td><td>${g.xs.length}</td><td>${g.r2.total}</td><td>${g.r1.counts[1]}</td><td>${g.r1.counts[2]}</td><td>${g.r1.counts[3]+g.r1.counts[4]}</td><td>${g.r2.counts[1]}</td><td>${g.t.buckets.improved.length}</td><td>${g.t.buckets.stable.length}</td><td>${g.t.buckets.waiting.length}</td></tr>`).join("");
  return `<article class="panel v5-report v104-dept-progress"><div class="v5-report-head"><div><h3>التطور الأكاديمي حسب القسم</h3><p>قراءة مستقلة تقارن مسار الزيارات داخل كل قسم، مع بقاء التحليل تراكميًا حسب ترتيب زيارة كل معلمة.</p></div></div><div class="table-wrap"><table><thead><tr><th>القسم</th><th>معلمات لهن رصد</th><th>وصلن للزيارة 2</th><th>جزئيًا — زيارة 1</th><th>تمامًا — زيارة 1</th><th>تجاوز — زيارة 1</th><th>جزئيًا — زيارة 2</th><th>تحسن من الجزئي</th><th>استمر جزئيًا</th><th>بانتظار إعادة زيارة</th></tr></thead><tbody>${body}</tbody></table></div><div class="analysis-note"><strong>مهم:</strong> المقارنة بين الأقسام تُقرأ مع حجم العينة؛ القسم الذي لم تصل فيه معلمات كافيات للزيارة الثانية لا يُحكم على اتجاه تطوره بعد.</div></article>`;
}
function v102OverallCompact(items,title){
  const rounds=v10RoundSummary(items);
  const rhtml=rounds.map(r=>`<tr><td>الزيارة ${r.n}</td><td>${r.total}</td>${[1,2,3,4].map(k=>`<td><button type="button" class="v102-rating-count" onclick="v102ToggleDetail('v102-round-${r.n}-${k}')">${r.counts[k]} <small>(${pct(r.counts[k],r.total)}%)</small></button></td>`).join('')}</tr>${[1,2,3,4].map(k=>{const b=v10RoundBuckets(items,r.n);return `<tr id="v102-round-${r.n}-${k}" class="v102-detail-row" hidden><td colspan="6"><strong>${['','يفي جزئيًا','يفي تمامًا','يتجاوز','يتجاوز بكثير'][k]} — الزيارة ${r.n}:</strong>${v10NamesCell(b[k])}</td></tr>`}).join('')}`).join('');
  const thtml=rounds.slice(0,-1).map(r=>{const x=v10TransitionSummary(items,r.n);return `<tr><td>${r.n} ← ${r.n+1}</td><td>${x.basePartial.length}</td><td>${x.followed.length}</td><td><button class="v102-count" onclick="v102ToggleDetail('v102-move-${r.n}-improved')">${x.buckets.improved.length}</button></td><td><button class="v102-count" onclick="v102ToggleDetail('v102-move-${r.n}-stable')">${x.buckets.stable.length}</button></td><td><button class="v102-count" onclick="v102ToggleDetail('v102-move-${r.n}-waiting')">${x.buckets.waiting.length}</button></td></tr><tr id="v102-move-${r.n}-improved" class="v102-detail-row" hidden><td colspan="6"><strong>تحسن:</strong>${v10NamesCell(x.buckets.improved)}</td></tr><tr id="v102-move-${r.n}-stable" class="v102-detail-row" hidden><td colspan="6"><strong>استمر جزئيًا:</strong>${v10NamesCell(x.buckets.stable)}</td></tr><tr id="v102-move-${r.n}-waiting" class="v102-detail-row" hidden><td colspan="6"><strong>بانتظار إعادة الزيارة:</strong>${v10NamesCell(x.buckets.waiting)}</td></tr>`}).join('');
  return `<article class="panel v5-report"><div class="v5-report-head"><div><h3>${esc(title)}</h3><p>التحليل حسب ترتيب زيارة كل معلمة، وليس حسب الشهر.</p></div><div class="v5-kpis"><b>${items.length}<small>معلمات لهن رصد</small></b><b>${rounds[0]?.total||0}<small>وصلن للزيارة 1</small></b><b>${rounds[1]?.total||0}<small>وصلن للزيارة 2</small></b><b>${rounds[2]?.total||0}<small>وصلن للزيارة 3</small></b></div></div><h4>تطور الحكم العام حسب ترتيب الزيارة</h4><div class="analysis-note">اضغطي على أي رقم لإظهار أسماء المعلمات وراءه.</div><div class="table-wrap"><table><thead><tr><th>ترتيب الزيارة</th><th>عدد المعلمات</th><th>يفي جزئيًا</th><th>يفي تمامًا</th><th>يتجاوز</th><th>يتجاوز بكثير</th></tr></thead><tbody>${rhtml||'<tr><td colspan="6">لا توجد بيانات.</td></tr>'}</tbody></table></div><h4>ماذا حدث لمن حصلن على «يفي جزئيًا»؟</h4><div class="table-wrap"><table><thead><tr><th>الانتقال</th><th>جزئي في السابقة</th><th>أعيدت زيارتهن</th><th>تحسن</th><th>استمر جزئيًا</th><th>بانتظار إعادة الزيارة</th></tr></thead><tbody>${thtml||'<tr><td colspan="6">نحتاج زيارتين على الأقل لقياس الانتقال.</td></tr>'}</tbody></table></div></article>`;
}
renderPerformanceProgress=function(){
  v8Fill("progressDept",activeRows(departments),"كل المدرسة",x=>x.id,x=>x.name);v8Fill("progressMonth",availableMonths(),"حتى آخر تاريخ متاح",x=>x,x=>v5MonthLabel(x));
  const dept=$("progressDept")?.value||"",month=$("progressMonth")?.value||"",out=$("performanceProgressOutput");if(!out)return;const items=v10ProgressDataset(dept,month);
  out.innerHTML=v102OverallCompact(items,dept?`تطور الأداء التراكمي — ${v5DeptName(dept)}`:"تطور الأداء التراكمي — مستوى المدرسة")+v103VisibleNamesByVisit(items)+v102LeadershipReading(items)+v102CriteriaSection(items)+v104DepartmentProgressSection(items,dept);
};
