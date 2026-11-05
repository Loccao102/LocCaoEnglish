import TeacherAnalytics from "@/components/TeacherAnalytics";

export default function AnalyticsPage() {
  return <div className="page-wrap">
    <header className="content-header"><div>
      <span className="eyebrow">TEACHER ANALYTICS</span>
      <h1>Understand learners’ checked practice.</h1>
      <p>Review completed practice and the kind of evidence behind it. Lesson activity is reported separately.</p>
    </div></header>
    <TeacherAnalytics />
  </div>;
}
