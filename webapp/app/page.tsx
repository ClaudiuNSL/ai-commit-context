import {
  MessageSquare,
  GitCommit,
  Eye,
  Zap,
  Shield,
  Users,
  ArrowRight,
  Check,
  Github,
  Terminal,
  Code2
} from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-dark-900/80 backdrop-blur-lg border-b border-dark-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-purple-500 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">AI Commit Context</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-dark-300 hover:text-white transition">Features</a>
              <a href="#how-it-works" className="text-dark-300 hover:text-white transition">How it works</a>
              <a href="#pricing" className="text-dark-300 hover:text-white transition">Pricing</a>
            </div>
            <div className="flex items-center gap-4">
              <a href="/login" className="text-dark-300 hover:text-white transition">Log in</a>
              <a
                href="/signup"
                className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                Get Started Free
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-dark-800 border border-dark-600 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-sm text-dark-300">Now with Supabase & GitHub integration</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            See the <span className="gradient-text">conversation</span>
            <br />behind every commit
          </h1>

          <p className="text-xl text-dark-300 max-w-3xl mx-auto mb-10">
            Stop guessing why code was written. AI Commit Context links your AI coding
            conversations to GitHub commits, so your team sees the full story.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition glow"
            >
              Start Free <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition"
            >
              <Eye className="w-5 h-5" /> View Demo
            </a>
          </div>

          {/* Hero Visual */}
          <div className="gradient-border p-1 max-w-4xl mx-auto">
            <div className="bg-dark-900 rounded-xl p-6 code-block">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-4 text-dark-400 text-sm">Pull Request #42</span>
              </div>

              <div className="text-left space-y-4">
                <div className="flex items-start gap-3 p-4 bg-dark-800/50 rounded-lg">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-dark-400 mb-1">AI Conversation linked to commit <code className="text-primary-400">a1b2c3d</code></div>
                    <div className="text-dark-200">
                      <span className="text-blue-400">Developer:</span> "I need JWT authentication with refresh tokens"
                    </div>
                    <div className="text-dark-200 mt-2">
                      <span className="text-green-400">Claude:</span> "I'll implement secure JWT auth with 24h expiry and refresh token rotation..."
                    </div>
                  </div>
                </div>

                <div className="text-primary-400 text-sm">
                  → Click to view full conversation with 47 messages
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos Section */}
      <section className="py-12 border-y border-dark-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-dark-400 mb-8">Works with your favorite tools</p>
          <div className="flex justify-center items-center gap-12 flex-wrap opacity-60">
            <Github className="w-10 h-10" />
            <Terminal className="w-10 h-10" />
            <Code2 className="w-10 h-10" />
            <div className="text-2xl font-bold">Claude</div>
            <div className="text-2xl font-bold">VS Code</div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Code reviews are <span className="text-red-400">broken</span>
              </h2>
              <p className="text-dark-300 text-lg mb-6">
                When reviewing a PR, you see <strong>what</strong> changed, but not <strong>why</strong>.
                You're left guessing the developer's intent, asking questions, and waiting for answers.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-dark-300">
                  <span className="text-red-400">✕</span> "Why did you choose this approach?"
                </li>
                <li className="flex items-center gap-3 text-dark-300">
                  <span className="text-red-400">✕</span> "What alternatives did you consider?"
                </li>
                <li className="flex items-center gap-3 text-dark-300">
                  <span className="text-red-400">✕</span> "What problem does this solve?"
                </li>
              </ul>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-6">
              <div className="text-sm text-dark-400 mb-2">Traditional PR Review</div>
              <div className="code-block p-4 text-sm">
                <div className="text-green-400">+ function authenticate(user) {'{'}</div>
                <div className="text-green-400">+   const token = jwt.sign(...);</div>
                <div className="text-green-400">+   return token;</div>
                <div className="text-green-400">+ {'}'}</div>
              </div>
              <div className="mt-4 text-dark-400 italic">
                🤔 "Why JWT? Why not sessions? What's the expiry?"
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-dark-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need for <span className="gradient-text">transparent</span> code reviews
            </h2>
            <p className="text-dark-300 text-lg max-w-2xl mx-auto">
              AI Commit Context captures and links your AI conversations automatically
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <MessageSquare className="w-6 h-6" />,
                title: "Auto-capture conversations",
                description: "Works silently in the background. No manual export needed."
              },
              {
                icon: <GitCommit className="w-6 h-6" />,
                title: "Link to commits",
                description: "Automatically connects conversations to the commits they created."
              },
              {
                icon: <Eye className="w-6 h-6" />,
                title: "PR integration",
                description: "See conversation links directly in your GitHub pull requests."
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "Instant setup",
                description: "One command to install. Works with any Git repository."
              },
              {
                icon: <Shield className="w-6 h-6" />,
                title: "Private & secure",
                description: "Your conversations stay private. Share only what you want."
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Team collaboration",
                description: "Share context with your team. Improve knowledge transfer."
              },
            ].map((feature, i) => (
              <div key={i} className="bg-dark-800/50 border border-dark-700 rounded-xl p-6 hover:border-primary-500/50 transition">
                <div className="w-12 h-12 bg-primary-500/10 rounded-lg flex items-center justify-center text-primary-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-dark-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How it works
            </h2>
            <p className="text-dark-300 text-lg">Three simple steps to better code reviews</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Install CLI",
                description: "Run npm install -g acc and acc init in your repo",
                code: "npm install -g @aicommitcontext/cli\ncd your-project\nacc init"
              },
              {
                step: "2",
                title: "Code with AI",
                description: "Work with Claude Code as usual. We track automatically.",
                code: "# Just code normally\n# Conversations are captured\n# No extra steps needed"
              },
              {
                step: "3",
                title: "Commit & Push",
                description: "Your PR will show links to the AI conversations",
                code: "git add .\ngit commit -m \"feat: add auth\"\ngit push"
              },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="text-8xl font-bold text-dark-800 absolute -top-4 -left-4">
                  {step.step}
                </div>
                <div className="relative bg-dark-800/50 border border-dark-700 rounded-xl p-6 pt-12">
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-dark-300 mb-4">{step.description}</p>
                  <div className="code-block p-3 text-sm text-dark-300">
                    <pre>{step.code}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-dark-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-dark-300 text-lg">Start free, upgrade when you need more</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-8">
              <h3 className="text-xl font-semibold mb-2">Free</h3>
              <div className="text-4xl font-bold mb-4">$0<span className="text-lg text-dark-400">/mo</span></div>
              <p className="text-dark-300 mb-6">For individual developers</p>
              <ul className="space-y-3 mb-8">
                {["5 sessions/month", "1 repository", "7 day history", "Community support"].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-dark-300">
                    <Check className="w-5 h-5 text-green-400" /> {feature}
                  </li>
                ))}
              </ul>
              <a href="/signup" className="block text-center bg-dark-700 hover:bg-dark-600 text-white px-6 py-3 rounded-lg font-medium transition">
                Get Started
              </a>
            </div>

            {/* Pro Plan */}
            <div className="gradient-border p-[2px] rounded-xl">
              <div className="bg-dark-900 rounded-xl p-8 h-full">
                <div className="inline-block bg-primary-500/10 text-primary-400 text-sm px-3 py-1 rounded-full mb-4">
                  Most Popular
                </div>
                <h3 className="text-xl font-semibold mb-2">Pro</h3>
                <div className="text-4xl font-bold mb-4">$9<span className="text-lg text-dark-400">/mo</span></div>
                <p className="text-dark-300 mb-6">For professional developers</p>
                <ul className="space-y-3 mb-8">
                  {["Unlimited sessions", "10 repositories", "Unlimited history", "Priority support", "GitHub Action"].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-dark-300">
                      <Check className="w-5 h-5 text-green-400" /> {feature}
                    </li>
                  ))}
                </ul>
                <a href="/signup?plan=pro" className="block text-center bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition">
                  Start Free Trial
                </a>
              </div>
            </div>

            {/* Team Plan */}
            <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-8">
              <h3 className="text-xl font-semibold mb-2">Team</h3>
              <div className="text-4xl font-bold mb-4">$29<span className="text-lg text-dark-400">/mo</span></div>
              <p className="text-dark-300 mb-6">For development teams</p>
              <ul className="space-y-3 mb-8">
                {["Everything in Pro", "5 team members", "Team dashboard", "Analytics", "SSO (coming soon)"].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-dark-300">
                    <Check className="w-5 h-5 text-green-400" /> {feature}
                  </li>
                ))}
              </ul>
              <a href="/signup?plan=team" className="block text-center bg-dark-700 hover:bg-dark-600 text-white px-6 py-3 rounded-lg font-medium transition">
                Start Free Trial
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to transform your code reviews?
          </h2>
          <p className="text-dark-300 text-lg mb-8">
            Join developers who are making their code changes transparent and understandable.
          </p>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition glow"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </a>
          <p className="text-dark-400 text-sm mt-4">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-dark-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-purple-500 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">AI Commit Context</span>
            </div>
            <div className="flex gap-8 text-dark-400">
              <a href="/privacy" className="hover:text-white transition">Privacy</a>
              <a href="/terms" className="hover:text-white transition">Terms</a>
              <a href="/docs" className="hover:text-white transition">Docs</a>
              <a href="https://github.com/ClaudiuNSL/ai-commit-context" className="hover:text-white transition">GitHub</a>
            </div>
            <div className="text-dark-400 text-sm">
              © 2024 AI Commit Context. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
