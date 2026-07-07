import TopNav from '../components/layout/TopNav';
import Footer from '../components/layout/Footer';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-void text-ink font-sans flex flex-col">
      <TopNav />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-24">
        <h1 className="font-mono text-4xl md:text-5xl text-ink mb-8 tracking-tighter">Privacy Policy</h1>
        
        <div className="space-y-8 text-muted leading-relaxed">
          <section>
            <h2 className="font-mono text-2xl text-ink mb-4">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us when you create an account, upload datasets, or connect databases. 
              Because Darelm operates autonomous AI agents, we also temporarily process the data you submit to generate insights, run code, and build machine learning models.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-2xl text-ink mb-4">2. Data Security & Isolation</h2>
            <p>
              Security is our highest priority. All data analysis and machine learning experiments are executed in secure, ephemeral sandbox environments. 
              These sandboxes are destroyed immediately after execution. We do not use your proprietary data to train our foundational models, and your datasets are never shared across different tenant accounts.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-2xl text-ink mb-4">3. Third-Party Services</h2>
            <p>
              We utilize third-party cloud infrastructure (like Alibaba Cloud and AWS) and isolated execution environments (like E2B). 
              While your data may be processed on these secure cloud providers, they are contractually obligated to maintain strict data confidentiality and security protocols.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-2xl text-ink mb-4">4. Your Rights</h2>
            <p>
              You maintain full ownership of your data. You may request the deletion of your account and all associated datasets at any time through your dashboard settings. 
              Upon deletion, all related data is permanently purged from our active databases and sandboxes.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
