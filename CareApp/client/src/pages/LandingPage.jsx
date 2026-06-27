import { BookOpenCheck, GraduationCap } from 'lucide-react';
import LoginQrCode from '../components/LoginQrCode.jsx';

export default function LandingPage({ onStudent, onAcademic }) {
  return (
    <main className="landing">
      <header className="landing-header">
        <div>
          <strong>OWBRHE</strong>
          <small>Care Study Submission</small>
        </div>
        <div className="author">
          <strong>Author</strong>
          <small>KYEREMEH</small>
        </div>
      </header>

      <div className="landing-strip" aria-hidden="true" />

      <section className="landing-actions" aria-label="Choose portal">
        <button className="large-choice" onClick={onStudent}>
          <GraduationCap size={28} />
          <span>Student</span>
        </button>
        <button className="large-choice" onClick={onAcademic}>
          <BookOpenCheck size={28} />
          <span>Academic</span>
        </button>
      </section>

      <LoginQrCode />

      <footer className="landing-footer">
        © 2026 Evans Kwadwo Kyeremeh. +233 249 305 925. All rights reserved.
      </footer>
    </main>
  );
}
