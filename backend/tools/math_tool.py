"""Math tool using sympy for efficient computation."""
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
from tools.registry import Tool, register

transformations = standard_transformations + (implicit_multiplication_application,)

class MathTool(Tool):
    name = "math_solve"
    description = "Solve math problems efficiently using sympy. Use for integrals, derivatives, equations, limits, series, matrices, etc. Pass the expression as valid Python/sympy syntax (e.g., 'integrate(x**2, x)', 'solve(x**2 - 4, x)', 'diff(sin(x), x)')."
    parameters = {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "The math expression or problem, e.g. 'integrate(x**2 * sin(x), x)' or 'diff(exp(x)*cos(x), x)' or 'solve(x**2 - 5*x + 6, x)'"
            },
            "variables": {
                "type": "string",
                "description": "Comma-separated variable names (default: 'x')",
                "default": "x"
            }
        },
        "required": ["expression"]
    }

    def _parse_and_solve(self, expr_str: str, vars_str: str = "x") -> str:
        try:
            symbols = sp.symbols(vars_str.replace(" ", "").split(","))
            local_dict = {s.name: s for s in symbols}
            try:
                if "=" in expr_str:
                    left, right = expr_str.split("=", 1)
                    eq = sp.Eq(parse_expr(left.strip(), local_dict=local_dict, transformations=transformations),
                               parse_expr(right.strip(), local_dict=local_dict, transformations=transformations))
                    sol = sp.solve(eq, symbols)
                    return f"Solution: {sol}"

                expr = parse_expr(expr_str, local_dict=local_dict, transformations=transformations)

                from sympy import Derivative, Integral, Limit

                if isinstance(expr, Integral):
                    result = expr.doit()
                    return f"Integral: {sp.pretty(result)}"
                elif isinstance(expr, Derivative):
                    result = expr.doit()
                    return f"Derivative: {sp.pretty(result)}"
                elif isinstance(expr, Limit):
                    result = expr.doit()
                    return f"Limit: {sp.pretty(result)}"

                result = expr
                if result.is_number:
                    return f"Result: {float(result)}"
                else:
                    return f"Result: {sp.pretty(result)}"

            except Exception as e1:
                try:
                    sol = sp.solve(expr_str, symbols)
                    if sol:
                        return f"Solution: {sol}"
                except:
                    pass
                return f"Error parsing: {e1}"
        except Exception as e:
            return f"Error: {e}"

    async def execute(self, expression: str, variables: str = "x") -> str:
        return self._parse_and_solve(expression, variables)

register(MathTool())
