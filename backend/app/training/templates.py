"""
Industry template seed data. Each template produces a list of module dicts
ready to insert as TrainingModule rows (minus track_id and id).
"""

TEMPLATES: dict[str, dict[str, list[dict]]] = {
    "restaurant": {
        "server": [
            {
                "type": "guide",
                "title": "Day One: What Every Server Needs to Know",
                "content": {
                    "text": (
                        "## Welcome\n\n"
                        "Your job is to make guests feel taken care of. Here's what matters most:\n\n"
                        "**Taking the order**\n"
                        "- Greet the table within 2 minutes of them sitting down\n"
                        "- Offer specials and ask about allergies before taking food orders\n"
                        "- Repeat the order back to confirm\n\n"
                        "**At the table**\n"
                        "- Check back 2 minutes after food arrives — not before\n"
                        "- Refill drinks before they're empty\n"
                        "- Clear plates when everyone at the table is done, not before\n\n"
                        "**The check**\n"
                        "- Never make a guest ask twice for the check\n"
                        "- Say 'I'll take that when you're ready' — not 'No rush'\n\n"
                        "When in doubt, ask a teammate. Nobody expects you to know everything on day one."
                    )
                },
                "order": 0,
            },
            {
                "type": "quiz",
                "title": "Quick Knowledge Check",
                "content": {
                    "questions": [
                        {
                            "question": "When should you greet a table after they sit down?",
                            "options": ["Within 2 minutes", "When they wave at you", "After 5 minutes", "When you finish your current table"],
                            "correct_index": 0,
                        },
                        {
                            "question": "When is the right time to clear a guest's plate?",
                            "options": ["As soon as they finish eating", "When everyone at the table is done", "After 10 minutes", "When they ask"],
                            "correct_index": 1,
                        },
                        {
                            "question": "A guest mentions they have a nut allergy. What do you do first?",
                            "options": ["Note it and tell the kitchen immediately", "Ask them to check the menu themselves", "Ignore it if they don't order nuts", "Tell the manager after the meal"],
                            "correct_index": 0,
                        },
                    ]
                },
                "order": 1,
            },
            {
                "type": "scenario",
                "title": "Real Situation: Unhappy Guest",
                "content": {
                    "situation": "A guest tells you their steak is overcooked. They seem frustrated. What do you do?",
                    "options": [
                        "Apologize sincerely, take the plate back, and tell them you'll have a new one out quickly",
                        "Tell them the kitchen is busy tonight and it might take a while to fix",
                        "Ask them if they're sure it's overcooked",
                    ],
                    "best_index": 0,
                    "explanation": "Always acknowledge the problem immediately and take action. A sincere apology + a quick fix turns most complaints around. Excuses or doubt make it worse.",
                },
                "order": 2,
            },
        ],
        "host": [
            {
                "type": "guide",
                "title": "Day One: Hosting Fundamentals",
                "content": {
                    "text": (
                        "## Your Role\n\n"
                        "You set the tone for the entire guest experience. The first 30 seconds matter.\n\n"
                        "**When guests arrive**\n"
                        "- Make eye contact and greet them within 10 seconds of entering\n"
                        "- 'Welcome in! How many in your party?' — simple and warm\n"
                        "- If there's a wait, give an honest time estimate\n\n"
                        "**Seating**\n"
                        "- Seat tables in rotation to keep servers from getting slammed\n"
                        "- Walk at the guest's pace, not yours\n"
                        "- Lay menus at each seat before leaving\n\n"
                        "**Managing the wait**\n"
                        "- Update waiting guests every 10 minutes if the wait is longer than expected\n"
                        "- Never promise a table time you can't deliver"
                    )
                },
                "order": 0,
            },
            {
                "type": "quiz",
                "title": "Quick Knowledge Check",
                "content": {
                    "questions": [
                        {
                            "question": "How soon should you greet guests after they walk in?",
                            "options": ["Within 10 seconds", "When you finish seating another table", "When they reach the host stand", "After a minute"],
                            "correct_index": 0,
                        },
                        {
                            "question": "Why do you seat tables in rotation?",
                            "options": ["To keep servers from getting overwhelmed all at once", "Because the manager said so", "To fill tables from front to back", "To give guests the best seats"],
                            "correct_index": 0,
                        },
                    ]
                },
                "order": 1,
            },
        ],
        "busser": [
            {
                "type": "guide",
                "title": "Day One: Bussing Basics",
                "content": {
                    "text": (
                        "## Your Job\n\n"
                        "A clean table turns faster. You keep the whole restaurant moving.\n\n"
                        "**Clearing a table**\n"
                        "- Clear only after ALL guests have finished and the server gives the go-ahead\n"
                        "- Stack plates quietly — no clanging\n"
                        "- Wipe down the table and seats before resetting\n\n"
                        "**Resetting**\n"
                        "- Replace napkins, silverware, and glasses exactly as the template shows\n"
                        "- Report any broken items to the server before the table is reseated\n\n"
                        "**During service**\n"
                        "- Refill water glasses without being asked\n"
                        "- Keep the busstation clean — your teammates depend on it"
                    )
                },
                "order": 0,
            },
        ],
    },
    "salon": {
        "stylist": [
            {
                "type": "guide",
                "title": "Day One: The Client Experience",
                "content": {
                    "text": (
                        "## First Impressions\n\n"
                        "Clients choose you because they trust you with something personal. Honor that.\n\n"
                        "**The consultation**\n"
                        "- Ask open questions: 'What are you going for?' before suggesting anything\n"
                        "- Confirm your understanding: 'So you want to take off about two inches and add layers — does that sound right?'\n"
                        "- Never start cutting until the client has nodded yes\n\n"
                        "**During the service**\n"
                        "- Keep conversation light unless the client goes quiet — then match their energy\n"
                        "- If something doesn't look right mid-service, say so calmly rather than hoping they won't notice\n\n"
                        "**Wrapping up**\n"
                        "- Show them the back with a mirror\n"
                        "- Recommend one product maximum — not a full routine\n"
                        "- Book the next appointment before they leave the chair"
                    )
                },
                "order": 0,
            },
            {
                "type": "quiz",
                "title": "Quick Knowledge Check",
                "content": {
                    "questions": [
                        {
                            "question": "What should you do before you start cutting a client's hair?",
                            "options": ["Confirm exactly what they want and get a clear yes", "Just start — you're the professional", "Ask the manager", "Show them a photo from Instagram"],
                            "correct_index": 0,
                        },
                        {
                            "question": "A client seems quiet during their service. What do you do?",
                            "options": ["Match their energy and give them space", "Keep talking to fill the silence", "Ask if something is wrong", "Speed up so they can leave sooner"],
                            "correct_index": 0,
                        },
                    ]
                },
                "order": 1,
            },
            {
                "type": "scenario",
                "title": "Real Situation: Client Unhappy With Result",
                "content": {
                    "situation": "A client looks in the mirror and seems unhappy, but doesn't say anything. What do you do?",
                    "options": [
                        "Ask directly: 'How are you feeling about it? I want to make sure you love it'",
                        "Stay quiet — if they don't say anything, they're probably fine",
                        "Tell them it looks great and start the checkout",
                    ],
                    "best_index": 0,
                    "explanation": "Most clients won't speak up unless you ask. A direct, caring question gives them permission to be honest — and gives you the chance to fix it before they leave unhappy.",
                },
                "order": 2,
            },
        ],
        "receptionist": [
            {
                "type": "guide",
                "title": "Day One: Front Desk Fundamentals",
                "content": {
                    "text": (
                        "## You Run the Front\n\n"
                        "Every client interaction starts and ends with you.\n\n"
                        "**Check-in**\n"
                        "- Greet every client by name if you know it — it matters more than you think\n"
                        "- Let the stylist know within 1 minute of the client arriving\n"
                        "- Offer water or a seat if there's a short wait\n\n"
                        "**Booking**\n"
                        "- Always confirm date, time, service, and stylist before ending the call\n"
                        "- If a time slot is unavailable, offer the two closest alternatives — not a list of options\n\n"
                        "**Checkout**\n"
                        "- Remind clients about rebooking: 'Would you like to book your next appointment now?'\n"
                        "- Process payment fully before the client walks out"
                    )
                },
                "order": 0,
            },
        ],
    },
    "retail": {
        "sales_associate": [
            {
                "type": "guide",
                "title": "Day One: Helping Customers on the Floor",
                "content": {
                    "text": (
                        "## Your Role\n\n"
                        "You make the store experience feel helpful, not pushy.\n\n"
                        "**Approaching customers**\n"
                        "- Give them 30 seconds to look around before approaching\n"
                        "- Open with a specific observation: 'That jacket you're looking at is one of our most popular' beats 'Can I help you?'\n"
                        "- If they say 'just browsing', say 'No problem — I'm around if anything catches your eye' and give them space\n\n"
                        "**Helping them decide**\n"
                        "- Ask about the occasion or who it's for — context helps you recommend the right thing\n"
                        "- Suggest at most two options, not five\n\n"
                        "**At the register**\n"
                        "- Mention one relevant add-on only if it genuinely makes sense\n"
                        "- Thank them by name if you got it during the transaction"
                    )
                },
                "order": 0,
            },
            {
                "type": "quiz",
                "title": "Quick Knowledge Check",
                "content": {
                    "questions": [
                        {
                            "question": "A customer says 'just browsing.' What's the best response?",
                            "options": [
                                "'No problem — I'm around if anything catches your eye'",
                                "Walk away and ignore them",
                                "Keep following them in case they need help",
                                "Tell them about your current promotions",
                            ],
                            "correct_index": 0,
                        },
                        {
                            "question": "How many product options should you suggest when helping a customer decide?",
                            "options": ["Two at most", "As many as possible so they have choices", "Just one", "Five — let them pick"],
                            "correct_index": 0,
                        },
                    ]
                },
                "order": 1,
            },
        ],
        "cashier": [
            {
                "type": "guide",
                "title": "Day One: Register Basics",
                "content": {
                    "text": (
                        "## The Register\n\n"
                        "Fast, accurate, and friendly — that's the goal.\n\n"
                        "**Each transaction**\n"
                        "- Greet the customer as they approach\n"
                        "- Scan items without rushing — errors slow everything down\n"
                        "- Announce the total clearly before they tap or swipe\n"
                        "- Give change back in bills first, then coins\n\n"
                        "**Common situations**\n"
                        "- Price discrepancy: call a manager, don't guess\n"
                        "- Return without receipt: follow the store policy exactly, no exceptions\n"
                        "- Long line behind a slow transaction: stay calm, don't rush the customer in front of you\n\n"
                        "**End of shift**\n"
                        "- Count your drawer before leaving — discrepancies need to be found before you go"
                    )
                },
                "order": 0,
            },
        ],
    },
}


def get_templates_list() -> list[dict]:
    """Return a flat list of available templates for the owner to browse."""
    result = []
    for industry, roles in TEMPLATES.items():
        for role_key, modules in roles.items():
            result.append({
                "industry": industry,
                "role_key": role_key,
                "display_name": f"{industry.title()} — {role_key.replace('_', ' ').title()}",
                "module_count": len(modules),
            })
    return result


def get_template_modules(industry: str, role_key: str) -> list[dict] | None:
    """Return module dicts for a given industry + role, or None if not found."""
    return TEMPLATES.get(industry, {}).get(role_key)
